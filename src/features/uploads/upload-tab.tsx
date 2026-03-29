"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EnrollmentUploader } from "./enrollment-uploader";
import { SessionUploader } from "./session-uploader";

interface Participant {
  id: string;
  label: string;
  displayName: string | null;
}

interface UploadTabProps {
  sessionId: string;
  participants: Participant[];
}

export function UploadTab({ sessionId, participants }: UploadTabProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-3">Enrollment Audio</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Upload a voice sample for each participant to enable speaker
          identification.
        </p>
        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add participants first before uploading enrollment audio.
          </p>
        ) : (
          <div className="space-y-2" key={refreshKey}>
            {participants.map((p) => (
              <EnrollmentUploader
                key={p.id}
                participantId={p.id}
                participantLabel={`${p.label}${p.displayName ? ` - ${p.displayName}` : ""}`}
                onUploadComplete={handleUploadComplete}
              />
            ))}
          </div>
        )}
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-medium mb-3">Session Media</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Upload the session recording (audio and/or video).
        </p>
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-sm font-medium mb-2">Session Audio</p>
            <SessionUploader
              sessionId={sessionId}
              type="SESSION_AUDIO"
              onUploadComplete={handleUploadComplete}
            />
          </Card>
          <Card className="p-4">
            <p className="text-sm font-medium mb-2">Session Video</p>
            <SessionUploader
              sessionId={sessionId}
              type="SESSION_VIDEO"
              onUploadComplete={handleUploadComplete}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
