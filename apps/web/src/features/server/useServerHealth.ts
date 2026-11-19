import { useEffect, useRef, useState } from 'react';
import { apiClient, type LimitsResponse } from './apiClient';

export function useServerHealth() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isWakingUp, setIsWakingUp] = useState<boolean>(false);
  const [serverError, setServerError] = useState<boolean>(false);
  const [limits, setLimits] = useState<LimitsResponse | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const isOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let wakeTimer: ReturnType<typeof setTimeout> | null = null;
    startTimeRef.current = Date.now();

    // If health check takes longer than 3 seconds, show wake-up banner
    wakeTimer = setTimeout(() => {
      if (isMounted && isOnlineRef.current === null) {
        setIsWakingUp(true);
      }
    }, 3000);

    const checkHealth = async (delayMs: number = 0) => {
      if (!isMounted) return;

      if (delayMs > 0) {
        await new Promise((resolve) => {
          timer = setTimeout(resolve, delayMs);
        });
      }

      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > 90000) {
        if (isMounted) {
          setIsWakingUp(false);
          setServerError(true);
        }
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const [health, limitsData] = await Promise.all([
          apiClient.getHealth(controller.signal),
          apiClient.getLimits(controller.signal).catch(() => null),
        ]);
        clearTimeout(timeoutId);

        if (isMounted && health.status === 'ok') {
          isOnlineRef.current = true;
          setIsOnline(true);
          setIsWakingUp(false);
          setServerError(false);
          if (limitsData) {
            setLimits(limitsData);
          }
        }
      } catch {
        if (isMounted) {
          // Retry every 3s up to 90s with backoff
          const nextDelay = elapsed > 30000 ? 5000 : 3000;
          checkHealth(nextDelay);
        }
      }
    };

    checkHealth(0);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      if (wakeTimer) clearTimeout(wakeTimer);
    };
  }, []);

  return { isOnline, isWakingUp, serverError, limits };
}
