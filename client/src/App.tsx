'use client';
import React, { useState, useEffect, useRef } from "react";

interface ParticipantMap {
  [id: string]: string;
}

export const App = () => {
  const SSE_URL = "/events";
  const LIST_URL = "/files";
  const UPLOAD_URL = "/upload";
  const NAME_URL = "/name-change";
  const BC_RECORD_URL = "/broadcast-record";

  const [myId, setMyId] = useState(() => {
    const stored = localStorage.getItem("my-participant-id");
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem("my-participant-id", newId);
    return newId;
  });
  const [myName, setMyName] = useState(`Guest_${Math.floor(Math.random() * 1000)}`);
  const [participants, setParticipants] = useState<ParticipantMap>({});
  const [files, setFiles] = useState<{ key: string; size: number }[]>([]);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    // Connect SSE
    const sse = new EventSource(SSE_URL);
    sse.onmessage = (msg) => {
      if (!msg.data) return;
      try {
        const data = JSON.parse(msg.data);
        if (data.kind === "files-updated") {
          // re-fetch files once
          fetch(LIST_URL).then((r) => r.json()).then(setFiles);
        } else if (data.kind === "record-command") {
          if (data.action === "start") {
            startLocalRecording();
          } else if (data.action === "stop") {
            stopLocalRecording();
          }
        } else if (data.kind === "name-change") {
          console.log("name-change", data);
          const participants: ParticipantMap = data.participants;
          setParticipants(participants);
        }
      } catch {
        // no-op
      }
    };
    sse.onerror = () => console.log("SSE error");
    return () => sse.close();
  }, []);

  useEffect(() => {
    // On mount, let the server know our name
    broadcastNameChange(myId, myName);
    fetch(LIST_URL).then((r) => r.json()).then(setFiles);
  }, []);

  const broadcastNameChange = (id: string, name: string) => {
    fetch(NAME_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    }).catch(console.error);
  };

  const startLocalRecording = async () => {
    if (recording) return;
    setRecording(true);
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 320000,
    });
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
  };

  const stopLocalRecording = () => {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
    recorderRef.current = null;
    setRecording(false);

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const fileName = `${myName}_${Date.now()}.webm`;
    const formData = new FormData();
    formData.append("audioFile", new File([blob], fileName));

    fetch(UPLOAD_URL, { method: "POST", body: formData })
      .then(() => console.log("upload complete"))
      .catch(console.error);
  };

  const handleRecordClick = () => {
    fetch(BC_RECORD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: recording ? "stop" : "start" }),
    }).catch(console.error);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setMyName(newName);
    broadcastNameChange(myId, newName);
  };


  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Mic Splice</h1>
      <div className="flex items-center gap-2 mb-2">
        <label>Your Name:</label>
        <input
          className="border rounded p-1"
          value={myName}
          onChange={handleNameChange}
        />
      </div>
      <button
        onClick={handleRecordClick}
        className="ml-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        {recording ? "Stop Recording" : "Start Recording"}
      </button>

      <div className="mt-4">
        <h2 className="font-semibold">Participants:</h2>
        <ul>
          {Object.entries(participants).map(([pid, pname]) => (
            <li key={pid} className={pid === myId ? "font-bold" : ""}>
              {pname}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <h2 className="font-semibold">Available Recordings:</h2>
        <ul>
          {files.map((f) => (
            <li key={f.key}>
              <a href={`/${encodeURIComponent(f.key)}`} target="_blank" rel="noreferrer">
                {f.key} ({f.size} bytes)
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default App;
