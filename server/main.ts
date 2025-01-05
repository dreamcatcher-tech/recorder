import { Application } from "@oak/oak/application";
import { Router } from "@oak/oak/router";
import { Context } from "@oak/oak/context";
import routeStaticFilesFrom from "./util/routeStaticFilesFrom.ts";
import "@std/dotenv/load";

import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

const app = new Application();
const router = new Router();

const BROADCAST_CHANNEL = new BroadcastChannel("global-room");

// Minimal in-memory state
type Participant = { id: string; name: string };
const participants = new Map<string, Participant>();

// We'll store a list of SSE connections:
const sseControllers: ReadableStreamDefaultController<string>[] = [];

// S3 client (Backblaze example config from .env)
const s3 = new S3Client({
  region: Deno.env.get("B2_REGION"),
  endpoint: Deno.env.get("B2_ENDPOINT"),
  credentials: {
    accessKeyId: Deno.env.get("B2_KEY_ID"),
    secretAccessKey: Deno.env.get("B2_APPLICATION_KEY"),
  },
});

// BroadcastChannel messages -> SSE
BROADCAST_CHANNEL.onmessage = (e) => {
  const { kind, payload } = e.data;
  if (kind === "FILES_UPDATED") {
    broadcastEvent("files-updated", {});
  } else if (kind === "RECORD_COMMAND") {
    broadcastEvent("record-command", payload);
  } else if (kind === "NAME_CHANGE") {
    broadcastEvent("name-change", payload);
  }
};

const broadcastEvent = (kind: string, payload: Record<string, unknown>) => {
  const msg = JSON.stringify({ kind, ...payload });
  for (const controller of sseControllers) {
    controller.enqueue(`data: ${msg}\n\n`);
  }
};

async function listFilesInBucket() {
  const bucketName = Deno.env.get("B2_BUCKET_NAME")
  if (!bucketName) {
    throw new Error("Bucket name is not set");
  }
  console.log("Listing files in bucket:", bucketName);
  const cmd = new ListObjectsV2Command({ Bucket: bucketName, });
  const resp = await s3.send(cmd);
  return (resp.Contents ?? []).map((c: { Key?: string; Size?: number }) => ({
    key: c.Key ?? "",
    size: c.Size ?? 0,
  }));
}

// SSE route
router.get("/events", (ctx) => {
  const body = new ReadableStream<string>({
    start(controller) {
      sseControllers.push(controller);
    },
    cancel() {
      // SSE closed
    },
  });

  ctx.response.headers.set("Content-Type", "text/event-stream");
  ctx.response.headers.set("Cache-Control", "no-cache");
  ctx.response.headers.set("Connection", "keep-alive");
  ctx.response.body = body;
});

// Upload audio
router.post("/upload", async (ctx: Context) => {
  const bucketName = Deno.env.get("B2_BUCKET_NAME") ?? "";
  const form = await ctx.request.body.formData()

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    ctx.throw(400, "No file uploaded");
  }

  const filename = file.name;
  const content = await file.arrayBuffer();

  // Optional: read 'startTimestamp' from fields to keep track of start time for sync
  const startTimestamp = form.get("startTimestamp") || "";

  const putCmd = new PutObjectCommand({
    Bucket: bucketName,
    Key: filename,
    Body: new Uint8Array(content),
    ContentType: file.type || "application/octet-stream",
    Metadata: {
      startTimestamp,
    },
  });

  await s3.send(putCmd);

  // Broadcast that files changed
  BROADCAST_CHANNEL.postMessage({ kind: "FILES_UPDATED" });
  ctx.response.body = "OK";
});

// List files
router.get("/files", async (ctx) => {
  const files = await listFilesInBucket();
  ctx.response.body = files;
});

// Serve a single file from S3
router.get("/:filename", async (ctx) => {
  const bucketName = Deno.env.get("B2_BUCKET_NAME") ?? "";
  const key = ctx.params.filename;
  if (!key) {
    ctx.throw(404, "No key");
  }

  try {
    const getCmd = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const result = await s3.send(getCmd);
    if (!result.Body) {
      ctx.throw(404, "Not found");
    }
    const stream = new ReadableStream({
      async start(controller) {
        const reader = result.Body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      },
    });
    ctx.response.type = result.ContentType ?? "application/octet-stream";
    ctx.response.body = stream;
  } catch {
    ctx.throw(404, "Not found");
  }
});

// Broadcast record command (with epoch timestamp if starting)
router.post("/broadcast-record", async (ctx) => {
  const { action } = await ctx.request.body.json();
  if (action === "start") {
    BROADCAST_CHANNEL.postMessage({
      kind: "RECORD_COMMAND",
      payload: { action, timestamp: Date.now() }, // Server's epoch time
    });
  } else {
    BROADCAST_CHANNEL.postMessage({ kind: "RECORD_COMMAND", payload: { action } });
  }
  ctx.response.body = "OK";
});

// Name change
router.post("/name-change", async (ctx) => {
  const { id, name } = await ctx.request.body.json();
  participants.set(id, { id, name });
  const participantsObj: Record<string, string> = {};
  for (const [pid, pinfo] of participants) {
    participantsObj[pid] = pinfo.name;
  }
  BROADCAST_CHANNEL.postMessage({ kind: "NAME_CHANGE", payload: { participants: participantsObj } });
  ctx.response.body = "OK";
});

app.use(router.routes());
app.use(router.allowedMethods());

// Finally serve static from dist + public
app.use(
  routeStaticFilesFrom([
    `${Deno.cwd()}/client/dist`,
    `${Deno.cwd()}/client/public`,
  ]),
);

if (import.meta.main) {
  console.log("Server listening on http://localhost:8001");
  await app.listen({ port: 8001, hostname: 'localhost' });
}

export { app };
