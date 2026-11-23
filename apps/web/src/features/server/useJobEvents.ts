import { useEffect, useRef } from 'react';
import { API_BASE_URL, apiClient, getHeaders, type JobSnapshotResponse } from './apiClient';
import type { AppError } from './errorToView';

type JobResult = NonNullable<JobSnapshotResponse['result']>;

interface JobEventsOptions {
  jobId: string | null;
  onProgress?: (progress: number, stage: string | null) => void;
  onDone?: (result: JobResult) => void;
  onError?: (error: AppError) => void;
}

const POLL_INTERVAL_MS = 1500;
/** Give up after this many consecutive failed polls (~90s), e.g. the server is down. */
const MAX_POLL_FAILURES = 60;
/** SSE attempts before switching to polling. */
const MAX_STREAM_ATTEMPTS = 2;

const JOB_LOST: AppError = {
  code: 'JOB_NOT_FOUND',
  message: 'The server restarted and lost this job. Please try again.',
  retryable: true,
};
const JOB_CANCELLED: AppError = { code: 'JOB_CANCELLED', message: 'Job was cancelled' };
const JOB_EXPIRED: AppError = {
  code: 'JOB_EXPIRED',
  message: 'This result has expired. Please convert again.',
  retryable: true,
};

type Terminal =
  | { kind: 'done'; result: JobResult }
  | { kind: 'error'; error: AppError };

/** Map a job snapshot (from SSE `status` or polling) to a terminal outcome, if it has one. */
function terminalFromSnapshot(snapshot: Partial<JobSnapshotResponse>): Terminal | null {
  switch (snapshot.status) {
    case 'succeeded':
      return snapshot.result ? { kind: 'done', result: snapshot.result } : null;
    case 'failed':
      return { kind: 'error', error: snapshot.error ?? { code: 'CONVERSION_FAILED' } };
    case 'cancelled':
      return { kind: 'error', error: JOB_CANCELLED };
    case 'expired':
      return { kind: 'error', error: JOB_EXPIRED };
    default:
      return null;
  }
}

function errorCode(err: unknown): string | undefined {
  return err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
    ? err.code
    : undefined;
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * Follow a server job until it finishes: SSE first, then polling as a fallback.
 * Always ends in exactly one onDone/onError call unless the component unmounts first.
 */
export function useJobEvents({ jobId, onProgress, onDone, onError }: JobEventsOptions) {
  const callbacksRef = useRef({ onProgress, onDone, onError });

  useEffect(() => {
    callbacksRef.current = { onProgress, onDone, onError };
  });

  useEffect(() => {
    if (!jobId) return;

    const controller = new AbortController();
    const { signal } = controller;
    let finished = false;

    const finish = (outcome: Terminal): void => {
      if (finished || signal.aborted) return;
      finished = true;
      const cb = callbacksRef.current;
      if (outcome.kind === 'done') {
        cb.onProgress?.(100, null);
        cb.onDone?.(outcome.result);
      } else {
        cb.onError?.(outcome.error);
      }
    };

    /** Returns a terminal outcome, or null if the stream ended without one. */
    const streamOnce = async (): Promise<Terminal | null> => {
      const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/events`, {
        headers: { ...getHeaders(), Accept: 'text/event-stream' },
        signal,
      });
      if (res.status === 404) return { kind: 'error', error: JOB_LOST };
      if (!res.ok || !res.body) throw new Error(`SSE stream failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) return null;

        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n');
        buffer = messages.pop() ?? '';

        for (const rawMsg of messages) {
          if (!rawMsg.trim() || rawMsg.startsWith(':')) continue; // heartbeat

          let eventType = 'message';
          let dataStr = '';
          for (const line of rawMsg.split('\n')) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim();
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
          }
          if (!dataStr) continue;

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataStr) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (eventType === 'progress') {
            callbacksRef.current.onProgress?.(
              typeof data.progress === 'number' ? data.progress : 0,
              typeof data.stage === 'string' ? data.stage : null
            );
          } else if (eventType === 'done' && data.result) {
            return { kind: 'done', result: data.result as JobResult };
          } else if (eventType === 'error') {
            return {
              kind: 'error',
              error: (data.error as AppError | undefined) ?? { code: 'CONVERSION_FAILED' },
            };
          } else if (eventType === 'status') {
            const terminal = terminalFromSnapshot(data as Partial<JobSnapshotResponse>);
            if (terminal) return terminal;
            if (typeof data.progress === 'number' && data.progress > 0) {
              callbacksRef.current.onProgress?.(
                data.progress,
                typeof data.stage === 'string' ? data.stage : null
              );
            }
          }
        }
      }
      return null;
    };

    const poll = async (): Promise<void> => {
      let failures = 0;
      while (!signal.aborted && !finished) {
        try {
          const snapshot = await apiClient.getJob(jobId, signal);
          failures = 0;
          const terminal = terminalFromSnapshot(snapshot);
          if (terminal) {
            finish(terminal);
            return;
          }
          callbacksRef.current.onProgress?.(snapshot.progress, snapshot.stage);
        } catch (err) {
          if (signal.aborted) return;
          if (errorCode(err) === 'JOB_NOT_FOUND') {
            finish({ kind: 'error', error: JOB_LOST });
            return;
          }
          failures += 1;
          if (failures >= MAX_POLL_FAILURES) {
            finish({
              kind: 'error',
              error: {
                code: 'NETWORK_ERROR',
                message: 'Lost contact with the server while waiting for the job.',
                retryable: true,
              },
            });
            return;
          }
        }
        await sleep(POLL_INTERVAL_MS, signal);
      }
    };

    const run = async (): Promise<void> => {
      for (let attempt = 0; attempt < MAX_STREAM_ATTEMPTS && !signal.aborted; attempt++) {
        try {
          const outcome = await streamOnce();
          if (outcome) {
            finish(outcome);
            return;
          }
          // Stream closed without a final event (restart, proxy idle timeout): try again.
        } catch {
          if (signal.aborted) return;
        }
        await sleep(1000, signal);
      }
      await poll();
    };

    void run();

    return () => {
      controller.abort();
    };
  }, [jobId]);
}
