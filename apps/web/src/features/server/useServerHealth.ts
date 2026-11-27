import { useEffect } from 'react';
import { create } from 'zustand';
import { apiClient, type LimitsResponse } from './apiClient';
import { useSettingsStore } from '@/features/settings/settingsStore';

/** After this long without a healthy response, show the "server offline" error. */
const GIVE_UP_MS = 90_000;
/** Show the "waking up" banner if the first check takes longer than this. */
const WAKE_BANNER_MS = 3_000;
const REQUEST_TIMEOUT_MS = 3_500;
const MIN_DELAY_MS = 2_000;
const MAX_DELAY_MS = 10_000;
/** Once offline, keep re-checking in the background at this interval. */
const OFFLINE_RECHECK_MS = 30_000;

export interface ServerHealthState {
  isOnline: boolean | null;
  isWakingUp: boolean;
  serverError: boolean;
  limits: LimitsResponse | null;
}

const initialState: ServerHealthState = {
  isOnline: null,
  isWakingUp: false,
  serverError: false,
  limits: null,
};

/** Shared across pages, so navigating between tools doesn't restart the check. */
export const useServerHealthStore = create<ServerHealthState>(() => ({ ...initialState }));

let started = false;
// Bumped on every (re)start so a stale polling loop stops itself.
let generation = 0;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimers(): void {
  if (pollTimer) clearTimeout(pollTimer);
  if (wakeTimer) clearTimeout(wakeTimer);
  pollTimer = null;
  wakeTimer = null;
}

async function checkOnce(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const [health, limits] = await Promise.all([
      apiClient.getHealth(controller.signal),
      apiClient.getLimits(controller.signal).catch(() => null),
    ]);
    if (health.status !== 'ok') return false;
    useServerHealthStore.setState((s) => ({
      isOnline: true,
      isWakingUp: false,
      serverError: false,
      limits: limits ?? s.limits,
    }));
    const settings = useSettingsStore.getState();
    if (limits?.accessCodeRequired && !settings.accessCode) settings.promptAccessCode();
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function poll(gen: number, startedAt: number, attempt: number): Promise<void> {
  if (gen !== generation) return;
  const ok = await checkOnce();
  if (gen !== generation || ok) {
    if (ok && wakeTimer) clearTimeout(wakeTimer);
    return;
  }

  let delay: number;
  if (Date.now() - startedAt > GIVE_UP_MS) {
    useServerHealthStore.setState({ isOnline: false, isWakingUp: false, serverError: true });
    delay = OFFLINE_RECHECK_MS;
  } else {
    // Exponential backoff while a cold start is likely in progress.
    delay = Math.min(MAX_DELAY_MS, MIN_DELAY_MS * 1.5 ** attempt);
  }
  pollTimer = setTimeout(() => void poll(gen, startedAt, attempt + 1), delay);
}

function startPolling(): void {
  generation += 1;
  const gen = generation;
  clearTimers();
  wakeTimer = setTimeout(() => {
    if (gen === generation && !useServerHealthStore.getState().isOnline) {
      useServerHealthStore.setState({ isWakingUp: true });
    }
  }, WAKE_BANNER_MS);
  void poll(gen, Date.now(), 0);
}

/** Manually re-check now (e.g. the "Retry" button on the offline alert). */
export function retryServerHealth(): void {
  started = true;
  useServerHealthStore.setState({ serverError: false, isWakingUp: true });
  startPolling();
}

function ensureStarted(): void {
  if (started) return;
  started = true;
  startPolling();
  if (typeof window !== 'undefined') {
    // Coming back online or to the tab: re-check right away if we think it's down.
    const recheckIfDown = (): void => {
      if (useServerHealthStore.getState().serverError) retryServerHealth();
    };
    window.addEventListener('online', recheckIfDown);
    window.addEventListener('focus', recheckIfDown);
  }
}

/** Test-only: reset the shared state and stop polling. */
export function resetServerHealthForTests(): void {
  generation += 1;
  clearTimers();
  started = false;
  useServerHealthStore.setState({ ...initialState });
}

export function useServerHealth(): ServerHealthState & { retry: () => void } {
  useEffect(() => {
    ensureStarted();
  }, []);
  const state = useServerHealthStore();
  return { ...state, retry: retryServerHealth };
}
