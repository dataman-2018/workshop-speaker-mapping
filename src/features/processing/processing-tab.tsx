"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface Job {
  id: string;
  status: string;
  progress: number;
  currentStep: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  ENROLLING: "secondary",
  DIARIZING: "secondary",
  MAPPING: "secondary",
  TRANSCRIBING: "secondary",
  COMPLETED: "default",
  FAILED: "destructive",
};

function isRunning(status: string) {
  return !["COMPLETED", "FAILED"].includes(status);
}

interface ProcessingTabProps {
  sessionId: string;
}

export function ProcessingTab({ sessionId }: ProcessingTabProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Poll active job
  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (res.ok) {
          const job: Job = await res.json();
          setJobs((prev) =>
            prev.map((j) => (j.id === jobId ? job : j))
          );
          if (!isRunning(job.status)) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        }
      } catch {
        // ignore
      }
    },
    []
  );

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Start polling if there's a running job
  useEffect(() => {
    const activeJob = jobs.find((j) => isRunning(j.status));
    if (activeJob && !pollingRef.current) {
      pollingRef.current = setInterval(() => pollJob(activeJob.id), 2000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [jobs, pollJob]);

  async function handleStart() {
    setStarting(true);
    try {
      const res = await fetch("/api/jobs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        const job: Job = await res.json();
        setJobs((prev) => [job, ...prev]);
      }
    } catch {
      // ignore
    } finally {
      setStarting(false);
    }
  }

  async function handleReprocess() {
    setReprocessing(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/reprocess`, {
        method: "POST",
      });
      if (res.ok) {
        const job: Job = await res.json();
        setJobs((prev) => [job, ...prev]);
      }
    } catch {
      // ignore
    } finally {
      setReprocessing(false);
    }
  }

  const hasRunningJob = jobs.some((j) => isRunning(j.status));
  const latestJob = jobs[0] ?? null;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          onClick={handleStart}
          disabled={starting || hasRunningJob}
        >
          {starting ? "Starting..." : "Start Processing"}
        </Button>
        <Button
          variant="outline"
          onClick={handleReprocess}
          disabled={reprocessing || hasRunningJob}
        >
          {reprocessing ? "Starting..." : "Reprocess"}
        </Button>
      </div>

      {latestJob && isRunning(latestJob.status) && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Current Job</span>
            <Badge variant={STATUS_VARIANT[latestJob.status] ?? "outline"}>
              {latestJob.status}
            </Badge>
          </div>
          {latestJob.currentStep && (
            <p className="text-sm text-muted-foreground">
              Step: {latestJob.currentStep}
            </p>
          )}
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${latestJob.progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {latestJob.progress}% complete
          </p>
        </Card>
      )}

      {latestJob?.error && (
        <Card className="p-4 border-destructive">
          <p className="text-sm font-medium text-destructive">Error</p>
          <p className="text-sm text-muted-foreground mt-1">
            {latestJob.error}
          </p>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-medium mb-3">Job History</h3>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No processing jobs yet. Click &quot;Start Processing&quot; to begin.
          </p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <Card key={job.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={STATUS_VARIANT[job.status] ?? "outline"}
                    >
                      {job.status}
                    </Badge>
                    {job.currentStep && (
                      <span className="text-xs text-muted-foreground">
                        {job.currentStep}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString()}
                  </div>
                </div>
                {job.progress > 0 && (
                  <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}
                {job.error && (
                  <p className="text-xs text-destructive mt-1">
                    {job.error}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
