import React from "react";

interface NameInputProps {
  value: string;
  onChange: (newName: string) => void;
}

export function NameInput({ value, onChange }: NameInputProps) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <label>Your Name:</label>
      <input
        className="border rounded p-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
