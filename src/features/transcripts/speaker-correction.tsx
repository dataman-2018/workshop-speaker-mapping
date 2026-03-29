"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Participant {
  id: string;
  label: string;
  displayName: string | null;
}

interface SpeakerCorrectionProps {
  utteranceId: string;
  currentParticipantId: string | null;
  participants: Participant[];
  onUpdate: () => void;
}

export function SpeakerCorrection({
  utteranceId,
  currentParticipantId,
  participants,
  onUpdate,
}: SpeakerCorrectionProps) {
  const [updating, setUpdating] = useState(false);

  async function handleChange(value: string | null) {
    if (!value) return;
    const participantId = value === "__unknown__" ? null : value;
    if (participantId === currentParticipantId) return;

    setUpdating(true);
    try {
      const res = await fetch(`/api/utterances/${utteranceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      if (res.ok) {
        onUpdate();
      }
    } catch {
      // ignore
    } finally {
      setUpdating(false);
    }
  }

  const currentValue = currentParticipantId ?? "__unknown__";

  return (
    <Select
      value={currentValue}
      onValueChange={handleChange}
      disabled={updating}
    >
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__unknown__">Unknown</SelectItem>
        {participants.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.label}
            {p.displayName ? ` - ${p.displayName}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
