// Queue abstraction for async job processing
// MVP: in-process execution. Production: replace with external queue.

export interface Job<T = unknown> {
  id: string;
  type: string;
  payload: T;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface QueueProcessor<T = unknown> {
  process(job: Job<T>): Promise<void>;
}
