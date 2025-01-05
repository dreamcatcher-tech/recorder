import React from "react";

interface RecordButtonProps {
  isRecording: boolean;
  isPending: boolean;
  onClick: () => void;
}

export function RecordButton({ isRecording, isPending, onClick }: RecordButtonProps) {
  let label = "Start Recording";
  if (isPending && !isRecording) {
    label = "Waiting to start…";
  } else if (isRecording) {
    label = "Stop Recording";
  }

  return (
    <button
      onClick={onClick}
      disabled={isPending && !isRecording}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
    >
      {label}
    </button>
  );
}
