import { useEffect, useRef } from 'react';
import { API_BASE_URL, apiClient, type JobSnapshotResponse } from './apiClient';
import { useSettingsStore } from '@/features/settings/settingsStore';
import type { AppError } from './errorToView';

interface JobEventsOptions {
  jobId: string | null;
  onProgress?: (progress: number, stage: string | null) => void;
  onDone?: (result: NonNullable<JobSnapshotResponse['result']>) => void;
  onError?: (error: AppError) => void;
}

export function useJobEvents({
  jobId,
  onProgress,
  onDone,
  onError,
}: JobEventsOptions) {
  const streamFailuresRef = useRef<number>(0);
  const activeControllerRef = useRef<AbortController | null>(null);
  const callbacksRef = useRef({ onProgress, onDone, onError });

  useEffect(() => {
    callbacksRef.current = { onProgress, onDone, onError };
  });

  useEffect(() => {
    if (!jobId) return;

    let isSubscribed = true;
    const controller = new AbortController();
    activeControllerRef.current = controller;

    const startPollingFallback = async () => {
      while (isSubscribed && !controller.signal.aborted) {
        try {
          const snapshot = await apiClient.getJob(jobId, controller.signal);
          if (snapshot.status === 'succeeded' && snapshot.result) {
            callbacksRef.current.onProgress?.(100, null);
            callbacksRef.current.onDone?.(snapshot.result);
            break;
          } else if (snapshot.status === 'failed') {
            callbacksRef.current.onError?.(
              snapshot.error ?? { code: 'CONVERSION_FAILED' }
            );
            break;
          } else if (snapshot.status === 'cancelled') {
            callbacksRef.current.onError?.({
              code: 'JOB_CANCELLED',
              message: 'Job was cancelled',
            });
            break;
          } else {
            callbacksRef.current.onProgress?.(snapshot.progress, snapshot.stage);
          }
        } catch {
          if (controller.signal.aborted) break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    };

    const startSseStream = async () => {
      try {
        const headers: Record<string, string> = {
          Accept: 'text/event-stream',
        };
        const accessCode = useSettingsStore.getState().accessCode;
        if (accessCode) {
          headers['X-Access-Code'] = accessCode;
        }

        const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/events`, {
          headers,
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error('SSE stream failed to open');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (isSubscribed) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split('\n\n');
          buffer = messages.pop() ?? '';

          for (const rawMsg of messages) {
            if (!rawMsg.trim() || rawMsg.startsWith(':')) {
              // Heartbeat or comment
              continue;
            }

            const lines = rawMsg.split('\n');
            let eventType = 'message';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.replace('event:', '').trim();
              } else if (line.startsWith('data:')) {
                dataStr = line.replace('data:', '').trim();
              }
            }

            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              if (eventType === 'progress') {
                callbacksRef.current.onProgress?.(
                  data.progress ?? 0,
                  data.stage ?? null
                );
              } else if (eventType === 'done' && data.result) {
                callbacksRef.current.onProgress?.(100, null);
                callbacksRef.current.onDone?.(data.result);
                return;
              } else if (eventType === 'error') {
                callbacksRef.current.onError?.(
                  data.error ?? { code: 'CONVERSION_FAILED' }
                );
                return;
              } else if (eventType === 'status') {
                if (data.status === 'succeeded' && data.result) {
                  callbacksRef.current.onDone?.(data.result);
                  return;
                } else if (data.status === 'cancelled') {
                  callbacksRef.current.onError?.({
                    code: 'JOB_CANCELLED',
                    message: 'Job was cancelled',
                  });
                  return;
                }
              }
            } catch {
              // Ignore malformed JSON event chunks
            }
          }
        }
      } catch {
        if (controller.signal.aborted) return;
        streamFailuresRef.current += 1;

        if (streamFailuresRef.current >= 2) {
          // Fall back to polling every 1.5s
          startPollingFallback();
        } else {
          // Retry SSE once after 1s
          setTimeout(() => {
            if (isSubscribed && !controller.signal.aborted) {
              startSseStream();
            }
          }, 1000);
        }
      }
    };

    startSseStream();

    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, [jobId]);
}
