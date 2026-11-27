import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { apiClient } from '@/features/server/apiClient';
import {
  resetServerHealthForTests,
  useServerHealth,
  useServerHealthStore,
} from '@/features/server/useServerHealth';

describe('server health (#11)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetServerHealthForTests();
  });
  afterEach(() => {
    resetServerHealthForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps re-checking after giving up and recovers on manual retry', async () => {
    const health = vi.spyOn(apiClient, 'getHealth').mockRejectedValue(new Error('down'));
    vi.spyOn(apiClient, 'getLimits').mockRejectedValue(new Error('down'));

    const { result } = renderHook(() => useServerHealth());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(105_000);
    });
    expect(result.current.serverError).toBe(true);

    // Still polling in the background after the 90 s give-up.
    const callsAfterGiveUp = health.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(health.mock.calls.length).toBeGreaterThan(callsAfterGiveUp);

    health.mockResolvedValue({ status: 'ok' } as Awaited<ReturnType<typeof apiClient.getHealth>>);
    await act(async () => {
      result.current.retry();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.serverError).toBe(false);
    expect(result.current.isOnline).toBe(true);
  });

  it('is shared: a second page does not restart polling', async () => {
    const health = vi
      .spyOn(apiClient, 'getHealth')
      .mockResolvedValue({ status: 'ok' } as Awaited<ReturnType<typeof apiClient.getHealth>>);
    vi.spyOn(apiClient, 'getLimits').mockRejectedValue(new Error('n/a'));

    renderHook(() => useServerHealth());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    renderHook(() => useServerHealth());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(health).toHaveBeenCalledTimes(1);
    expect(useServerHealthStore.getState().isOnline).toBe(true);
  });
});
