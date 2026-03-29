"use client";

import { useState, useRef } from "react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface EnrollmentUploaderProps {
  participantId: string;
  participantLabel: string;
  onUploadComplete?: () => void;
}

export function EnrollmentUploader({
  participantId,
  participantLabel,
  onUploadComplete,
}: EnrollmentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
        handleUploadUrl: "/api/uploads/enrollment",
        clientPayload: JSON.stringify({ participantId }),
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
    <div className="flex items-center gap-3 p-3 border rounded-md">
      <Badge variant="outline">{participantLabel}</Badge>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={handleUpload}
        disabled={uploading}
        className="text-sm"
      />
      {uploading && (
        <span className="text-sm text-muted-foreground">{progress}%</span>
      )}
      {success && (
        <span className="text-sm text-green-600">Uploaded</span>
      )}
      {error && (
        <span className="text-sm text-red-600">{error}</span>
      )}
    </div>
  );
}
