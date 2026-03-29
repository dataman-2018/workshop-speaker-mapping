"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTimestamp } from "@/lib/format";
import { SpeakerCorrection } from "./speaker-correction";

interface Participant {
  id: string;
  label: string;
  displayName: string | null;
}

interface Utterance {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  assignment: {
    id: string;
    participantId: string | null;
    confidence: number;
    isManual: boolean;
    participant: Participant | null;
  } | null;
}

type FilterMode = "all" | "unknown";

function getConfidenceLevel(assignment: Utterance["assignment"]): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (!assignment || assignment.participantId === null) {
    return { label: "unknown", variant: "outline" };
  }
  const c = assignment.confidence;
  if (c >= 0.8) return { label: "high", variant: "default" };
  if (c >= 0.5) return { label: "medium", variant: "secondary" };
  return { label: "low", variant: "destructive" };
}

interface TranscriptTabProps {
  sessionId: string;
  participants: Participant[];
}

export function TranscriptTab({ sessionId, participants }: TranscriptTabProps) {
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");

  const fetchTranscript = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/transcript`);
      if (res.ok) {
        const data = await res.json();
        setUtterances(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchTranscript();
  }, [fetchTranscript]);

  const filtered =
    filter === "unknown"
      ? utterances.filter(
          (u) => !u.assignment || u.assignment.participantId === null
        )
      : utterances;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading transcript...</p>;
  }

  if (utterances.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No transcript available. Run processing first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          Show all ({utterances.length})
        </Button>
        <Button
          variant={filter === "unknown" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("unknown")}
        >
          Unknown only (
          {
            utterances.filter(
              (u) => !u.assignment || u.assignment.participantId === null
            ).length
          }
          )
        </Button>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-2 pr-4">
          {filtered.map((u) => {
            const conf = getConfidenceLevel(u.assignment);

            return (
              <Card key={u.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 shrink-0 min-w-[60px]">
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatTimestamp(u.startTime)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <SpeakerCorrection
                      utteranceId={u.id}
                      currentParticipantId={
                        u.assignment?.participantId ?? null
                      }
                      participants={participants}
                      onUpdate={fetchTranscript}
                    />
                    <Badge variant={conf.variant}>{conf.label}</Badge>
                  </div>

                  <p className="text-sm flex-1">{u.text}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
