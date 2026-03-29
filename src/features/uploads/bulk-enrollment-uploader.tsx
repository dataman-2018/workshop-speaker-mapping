"use client";

import { useState, useRef, useCallback } from "react";
import { upload } from "@vercel/blob/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { splitAudioFile } from "@/lib/audio/client-splitter";

// ── Types ──────────────────────────────────────────────────────────────

interface AnalyzedSpeaker {
  cluster: string;
  suggestedName: string;
  label: string;
  sourceText: string;
  startTime: number;
  endTime: number;
  segments: Array<{ startTime: number; endTime: number; text: string }>;
  bestSegment: { startTime: number; endTime: number };
}

interface AnalyzeResponse {
  speakers: AnalyzedSpeaker[];
  totalDuration: number;
  numSpeakers: number;
}

interface EditableSpeaker extends AnalyzedSpeaker {
  editedName: string;
}

interface BulkEnrollmentUploaderProps {
  sessionId: string;
  onComplete?: () => void;
}

type Step = "upload" | "review" | "processing" | "complete";

// ── Component ──────────────────────────────────────────────────────────

export function BulkEnrollmentUploader({
  sessionId,
  onComplete,
}: BulkEnrollmentUploaderProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [speakers, setSpeakers] = useState<EditableSpeaker[]>([]);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(
    null
  );
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Step 1: Upload & Analyze ─────────────────────────────────────

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        setFile(selected);
        setError(null);
      }
    },
    []
  );

  const handleAnalyze = useCallback(async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Upload to blob
      setProcessingStatus("Uploading audio file...");
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/uploads/blob",
        onUploadProgress: ({ percentage }) => {
          setUploadProgress(Math.round(percentage));
        },
      });

      // Analyze (synchronous — runs diarization + transcription in parallel, up to 60s)
      setProcessingStatus("Analyzing speakers (this may take up to a minute)...");
      setUploadProgress(100);

      const res = await fetch("/api/enrollment/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: blob.url, sessionId }),
        signal: AbortSignal.timeout(120_000), // 2 min client timeout
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Analysis failed");
      }

      const data: AnalyzeResponse = await res.json();

      if (data.speakers.length === 0) {
        throw new Error("No speakers detected in the audio file.");
      }

      setAnalyzeResult(data);
      setSpeakers(
        data.speakers.map((s) => ({
          ...s,
          editedName: s.suggestedName || "",
        }))
      );
      setStep("review");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
      setProcessingStatus("");
    }
  }, [file, sessionId]);

  // ── Step 2: Review & Edit ────────────────────────────────────────

  const handleNameChange = useCallback((index: number, name: string) => {
    setSpeakers((prev) =>
      prev.map((s, i) => (i === index ? { ...s, editedName: name } : s))
    );
  }, []);

  // ── Step 3: Process & Register ───────────────────────────────────

  const handleConfirm = useCallback(async () => {
    if (!file || speakers.length === 0) return;

    setStep("processing");
    setError(null);
    setProcessingProgress(0);

    try {
      const total = speakers.length;

      // Split audio client-side
      setProcessingStatus(`Splitting audio into ${total} segments...`);
      const segmentBlobs = await splitAudioFile(
        file,
        speakers.map((s) => ({
          startTime: s.bestSegment.startTime,
          endTime: s.bestSegment.endTime,
        }))
      );
      setProcessingProgress(30);

      // Upload each segment to blob
      setProcessingStatus("Uploading speaker segments...");
      const segmentUrls: string[] = [];

      for (let i = 0; i < segmentBlobs.length; i++) {
        const segmentFile = new File(
          [segmentBlobs[i]],
          `enrollment-${speakers[i].label}.wav`,
          { type: "audio/wav" }
        );

        const blob = await upload(segmentFile.name, segmentFile, {
          access: "public",
          handleUploadUrl: "/api/uploads/blob",
        });

        segmentUrls.push(blob.url);
        setProcessingProgress(30 + Math.round(((i + 1) / total) * 50));
        setProcessingStatus(
          `Uploading segment ${i + 1}/${total}...`
        );
      }

      // Batch create participants + enrollment samples
      setProcessingStatus("Registering participants...");
      const batchRes = await fetch("/api/enrollment/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          speakers: speakers.map((s, i) => ({
            name: s.editedName || s.suggestedName || `Speaker ${s.label}`,
            blobUrl: segmentUrls[i],
            label: s.label,
          })),
        }),
      });

      if (!batchRes.ok) {
        const data = await batchRes.json();
        throw new Error(data.error || "Batch enrollment failed");
      }

      const batchData = await batchRes.json();
      setCreatedCount(batchData.participants.length);
      setProcessingProgress(100);
      setStep("complete");
      onComplete?.();
    } catch (err) {
      setError((err as Error).message);
      setStep("review"); // Allow retry from review step
    } finally {
      setProcessingStatus("");
    }
  }, [file, speakers, sessionId, onComplete]);

  // ── Step 4: Complete ─────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setSpeakers([]);
    setAnalyzeResult(null);
    setUploadProgress(0);
    setProcessingStatus("");
    setProcessingProgress(0);
    setError(null);
    setCreatedCount(0);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <Card className="p-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-4">
        {(["upload", "review", "processing", "complete"] as Step[]).map(
          (s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && (
                <div className="w-6 h-px bg-muted-foreground/30" />
              )}
              <Badge
                variant={step === s ? "default" : "outline"}
                className="text-xs"
              >
                {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </Badge>
            </div>
          )
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload a single audio file containing consecutive
            self-introductions. The system will detect individual speakers and
            extract their names.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            disabled={isLoading}
            className="text-sm"
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              Selected: {file.name} (
              {(file.size / (1024 * 1024)).toFixed(1)} MB)
            </p>
          )}
          {isLoading && (
            <div className="space-y-1">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {processingStatus}
              </p>
            </div>
          )}
          <Button
            onClick={handleAnalyze}
            disabled={!file || isLoading}
            size="sm"
          >
            {isLoading ? "Analyzing..." : "Analyze Speakers"}
          </Button>
        </div>
      )}

      {/* Step 2: Review */}
      {step === "review" && (
        <div className="space-y-3">
          {analyzeResult && (
            <p className="text-sm text-muted-foreground">
              Detected {analyzeResult.numSpeakers} speaker
              {analyzeResult.numSpeakers !== 1 ? "s" : ""} in{" "}
              {Math.round(analyzeResult.totalDuration)}s of audio. Edit names
              below, then confirm.
            </p>
          )}
          <div className="space-y-2">
            {speakers.map((speaker, index) => (
              <div
                key={speaker.cluster}
                className="flex items-start gap-3 p-3 border rounded-md"
              >
                <Badge variant="outline" className="mt-1 shrink-0">
                  {speaker.label}
                </Badge>
                <div className="flex-1 space-y-1">
                  <Input
                    value={speaker.editedName}
                    onChange={(e) => handleNameChange(index, e.target.value)}
                    placeholder="Speaker name"
                    className="h-8 text-sm"
                  />
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {speaker.sourceText}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(speaker.startTime)} &ndash;{" "}
                    {formatTime(speaker.endTime)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleConfirm} size="sm">
              Confirm &amp; Register
            </Button>
            <Button onClick={handleReset} variant="outline" size="sm">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Processing */}
      {step === "processing" && (
        <div className="space-y-3">
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{processingStatus}</p>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === "complete" && (
        <div className="space-y-3">
          <p className="text-sm text-green-600">
            Successfully registered {createdCount} participant
            {createdCount !== 1 ? "s" : ""} with enrollment samples.
          </p>
          <Button onClick={handleReset} variant="outline" size="sm">
            Enroll More
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
