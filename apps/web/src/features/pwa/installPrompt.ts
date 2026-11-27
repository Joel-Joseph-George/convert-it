import { create } from "zustand";

/**
 * Tracks whether ConvertIt can be installed as an app.
 * - Chrome/Edge/Android fire `beforeinstallprompt`; we keep that event so a button
 *   can show the browser's own install dialog later.
 * - iOS Safari has no such event: installing is Share → Add to Home Screen, so we
 *   only show instructions there.
 * Nothing shows once the app is already running installed.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallMode = "prompt" | "ios" | null;

interface InstallState {
  mode: InstallMode;
  promptEvent: BeforeInstallPromptEvent | null;
  /** Show the browser's install dialog. Resolves true if the user accepted. */
  install: () => Promise<boolean>;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches)
  );
}

/** iPhone/iPad Safari (not Chrome or Firefox for iOS, which can't add to the home screen the same way). */
export function isIosSafari(userAgent: string, maxTouchPoints = 0): boolean {
  const ios =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return (
    ios &&
    /Safari/.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent)
  );
}

export const useInstallStore = create<InstallState>((set, get) => ({
  mode: null,
  promptEvent: null,
  install: async () => {
    const event = get().promptEvent;
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // A prompt event can only be used once.
    set({ promptEvent: null, mode: null });
    return outcome === "accepted";
  },
}));

/** Start listening as early as possible: the browser may fire the event before React renders. */
export function initInstallPrompt(): void {
  if (typeof window === "undefined" || isStandalone()) return;
  if (isIosSafari(navigator.userAgent, navigator.maxTouchPoints)) {
    useInstallStore.setState({ mode: "ios" });
    return;
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // keep Chrome's mini-infobar from competing with our button
    useInstallStore.setState({
      mode: "prompt",
      promptEvent: event as BeforeInstallPromptEvent,
    });
  });
  window.addEventListener("appinstalled", () => {
    useInstallStore.setState({ mode: null, promptEvent: null });
  });
}
