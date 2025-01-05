import React from "react";

interface RecordingFile {
  key: string;
  size: number;
}

interface RecordingsListProps {
  files: RecordingFile[];
}

export const RecordingsList = ({ files }: RecordingsListProps) => {
  // Group them by "YYYY-MM-DD_HHmm_sessionName"
  const groups = files.reduce((acc, file) => {
    // Example key: 2024-09-23_1342_sessionName_participantName.webm
    const [sessionKey, participant] = file.key.split(/_(?!.*_)/); 
    // sessionKey = "2024-09-23_1342_sessionName"
    // participant = "participantName.webm" (or similar)
    if (!acc[sessionKey]) {
      acc[sessionKey] = [];
    }
    acc[sessionKey].push(file);
    return acc;
  }, {} as Record<string, RecordingFile[]>);

  const handleGroupDownload = (groupKey: string) => {
    // Could call an endpoint that zips the group, or fetch each file client-side
    alert(`Download entire group: ${groupKey}`);
  };

  return (
    <div>
      <h2 className="font-semibold">Recordings:</h2>
      {Object.entries(groups).map(([groupKey, groupFiles]) => (
        <div key={groupKey} className="my-2 p-2 border">
          <div className="font-bold flex items-center justify-between">
            <span>{groupKey}</span>
            <button
              className="px-2 py-1 bg-gray-300 rounded"
              onClick={() => handleGroupDownload(groupKey)}
            >
              Download Group
            </button>
          </div>
          <ul className="ml-4">
            {groupFiles.map((file) => {
              const fileUrl = `/${encodeURIComponent(file.key)}`;
              return (
                <li key={file.key} className="my-1">
                  <div>{file.key}</div>
                  <audio controls src={fileUrl} />
                  <a
                    href={fileUrl}
                    download
                    className="ml-2 px-2 py-1 bg-blue-600 text-white rounded"
                  >
                    Download
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};
