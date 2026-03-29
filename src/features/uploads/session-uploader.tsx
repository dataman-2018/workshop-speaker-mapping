"use client";

import { useState, useRef } from "react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";

interface SessionUploaderProps {
  sessionId: string;
  type: "SESSION_AUDIO" | "SESSION_VIDEO";
  onUploadComplete?: () => void;
}

export function SessionUploader({
  sessionId,
  type,
  onUploadComplete,
}: SessionUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = type === "SESSION_VIDEO" ? "video/*" : "audio/*";
  const label = type === "SESSION_VIDEO" ? "video" : "audio";

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(false);
    setProgress(0);

    try {
      await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/uploads/session",
        clientPayload: JSON.stringify({ sessionId, type }),
        onUploadProgress: ({ percentage }) => {
          setProgress(Math.round(percentage));
        },
      });

      setSuccess(true);
      onUploadComplete?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleUpload}
          disabled={uploading}
          className="text-sm"
        />
        {uploading && (
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
        )}
        {success && (
          <span className="text-sm text-green-600">
            Session {label} uploaded
          </span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
