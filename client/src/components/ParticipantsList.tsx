import React from "react";

interface ParticipantsListProps {
  participants: Record<string, string>;
  currentUserId: string;
}

export function ParticipantsList({ participants, currentUserId }: ParticipantsListProps) {
  return (
    <div className="mt-4">
      <h2 className="font-semibold">Participants:</h2>
      <ul>
        {Object.entries(participants).map(([pid, pname]) => (
          <li key={pid} className={pid === currentUserId ? "font-bold" : ""}>
            {pname}
          </li>
        ))}
      </ul>
    </div>
  );
}
