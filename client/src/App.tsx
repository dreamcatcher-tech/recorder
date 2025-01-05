"use client";
import React, { useEffect, useState } from "react";

// Custom hook for local recording
import { useLocalRecorder } from "./hooks/useLocalRecorder.ts";

// UI Components
import { NameInput } from "./components/NameInput.tsx";
import { RecordButton } from "./components/RecordButton.tsx";
import { ParticipantsList } from "./components/ParticipantsList.tsx";
import { RecordingsList } from "./components/RecordingsList.tsx";

interface ParticipantMap {
  [id: string]: string;
}

export default function App() {
  // Endpoints
  const SSE_URL = "/events";
  const LIST_URL = "/files";
  const UPLOAD_URL = "/upload";
  const NAME_URL = "/name-change";
  const BC_RECORD_URL = "/broadcast-record";

  // Participant ID / Name
  const [myId, setMyId] = useState(() => {
    const stored = localStorage.getItem("my-participant-id");
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem("my-participant-id", newId);
    return newId;
  });
  const [myName, setMyName] = useState(
    `Guest_${Math.floor(Math.random() * 1000)}`
  );

  // Server-managed state
  const [participants, setParticipants] = useState<ParticipantMap>({});
  const [files, setFiles] = useState<{ key: string; size: number }[]>([]);
  
  // For synchronizing local and server start times
  const [serverStartTime, setServerStartTime] = useState<number | null>(null);

  // Local recorder custom hook
  const {
    isRecording,
    isPending,
    startRecording,
    stopRecording,
    setIsPending
  } = useLocalRecorder({
    onUpload: async (formData) => {
      // Upload to server
      await fetch(UPLOAD_URL, {
        method: "POST",
        body: formData,
      });
      console.log("Upload complete");
    },
  });

  // On mount, broadcast our name and fetch file list
  useEffect(() => {
    broadcastNameChange(myId, myName);
    fetchFileList();
  }, []);

  // Set up SSE listener
  useEffect(() => {
    const sse = new EventSource(SSE_URL);

    sse.onmessage = (event) => {
      if (!event.data) return;
      try {
        const data = JSON.parse(event.data);

        switch (data.kind) {
          case "files-updated":
            // Re-fetch
            fetchFileList();
            break;

          case "record-command":
            if (data.action === "start") {
              // Let local UI know the server started recording at a certain timestamp
              setServerStartTime(data.timestamp);
              setIsPending(false);
              startRecording();
            } else if (data.action === "stop") {
              stopRecording();
            }
            break;

          case "name-change":
            // Entire updated participants map
            setParticipants(data.participants);
            break;
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    sse.onerror = () => {
      console.error("SSE error");
    };

    return () => {
      sse.close();
    };
  }, [startRecording, stopRecording, setIsPending]);

  // Helpers
  function fetchFileList() {
    fetch(LIST_URL)
      .then((r) => r.json())
      .then(setFiles)
      .catch(console.error);
  }

  function broadcastNameChange(id: string, name: string) {
    fetch(NAME_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    }).catch(console.error);
  }

  // UI actions
  function handleNameChange(newName: string) {
    setMyName(newName);
    broadcastNameChange(myId, newName);
  }

  function handleRecordClick() {
    if (!isRecording && !isPending) {
      // user wants to start
      setIsPending(true);
      fetch(BC_RECORD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      }).catch((err) => {
        console.error(err);
        setIsPending(false);
      });
    } else {
      // user wants to stop
      fetch(BC_RECORD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      }).catch(console.error);
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Mic Splice</h1>
      
      <NameInput value={myName} onChange={handleNameChange} />

      <RecordButton
        isRecording={isRecording}
        isPending={isPending}
        onClick={handleRecordClick}
      />

      <ParticipantsList
        participants={participants}
        currentUserId={myId}
      />

      <RecordingsList files={files} />
    </div>
  );
}
