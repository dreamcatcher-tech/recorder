import { useRef, useState } from "react";

export interface UseLocalRecorderConfig {
    onUpload: (formData: FormData) => Promise<void>;
}

export interface UseLocalRecorder {
    isRecording: boolean;
    isPending: boolean;
    startRecording: () => Promise<void>;
    stopRecording: (serverStartTime?: number) => void;
    setIsPending: (p: boolean) => void;
}

/**
 * Encapsulates local MediaRecorder logic (start/stop, capturing chunks, uploading).
 * Expects a callback `onUpload` that knows how to send the final file to the server.
 */
export function useLocalRecorder(config: UseLocalRecorderConfig): UseLocalRecorder {
    const { onUpload } = config;

    const [isRecording, setIsRecording] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);

    async function startRecording() {
        if (isRecording) return;
        setIsRecording(true);
        setIsPending(false);
        chunksRef.current = [];

        // Request audio only
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
        });

        const recorder = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
            audioBitsPerSecond: 320000,
        });

        recorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start();
    }

    function stopRecording(serverStartTime?: number) {
        if (!recorderRef.current) return;
        recorderRef.current.stop();
        recorderRef.current = null;
        setIsRecording(false);
        setIsPending(false);

        // Build blob and pass to the server
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const fileName = `recording_${Date.now()}.webm`;

        const formData = new FormData();
        formData.append("audioFile", new File([blob], fileName));

        if (typeof serverStartTime === "number") {
            formData.append("startTimestamp", serverStartTime.toString());
        }

        onUpload(formData).catch(console.error);
    }

    return {
        isRecording,
        isPending,
        startRecording,
        stopRecording,
        setIsPending,
    };
}
