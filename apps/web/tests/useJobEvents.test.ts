import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useJobEvents } from '@/features/server/useJobEvents';
import { ApiClientError, apiClient } from '@/features/server/apiClient';

function sseResponse(body: string, status = 200): Response {
  return new Response(new TextEncoder().encode(body), {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('useJobEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reports a job that already failed in the initial status snapshot', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse(
        'event: status\ndata: {"status":"failed","error":{"code":"UPSTREAM_BLOCKED"}}\n\n'
      )
    );
    const onError = vi.fn();
    renderHook(() => useJobEvents({ jobId: 'j1', onError }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith({ code: 'UPSTREAM_BLOCKED' }));
  });

  it('falls back to polling when the stream closes early, and stops on a lost job', async () => {
    // Stream closes without a terminal event every time (e.g. server restarting).
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      sseResponse('event: status\ndata: {"status":"running","progress":0}\n\n')
    );
    vi.spyOn(apiClient, 'getJob').mockRejectedValue(
      new ApiClientError({ code: 'JOB_NOT_FOUND', message: 'Job not found.' })
    );
    const onError = vi.fn();
    renderHook(() => useJobEvents({ jobId: 'j2', onError }));

    await vi.advanceTimersByTimeAsync(3000);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ code: 'JOB_NOT_FOUND' });
  });

  it('delivers the result once on done', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse(
        'event: progress\ndata: {"progress":40,"stage":"downloading"}\n\n' +
          'event: done\ndata: {"result":{"filename":"a.mp3","sizeBytes":1,"mime":"audio/mpeg","expiresAt":"x"}}\n\n'
      )
    );
    const onDone = vi.fn();
    const onProgress = vi.fn();
    renderHook(() => useJobEvents({ jobId: 'j3', onDone, onProgress }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onProgress).toHaveBeenCalledWith(40, 'downloading');
  });
});
