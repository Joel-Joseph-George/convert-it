import { create } from 'zustand';
import { apiClient } from '../server/apiClient';
import type { AppError } from '../server/errorToView';
import type { YouTubeFlowStatus, YouTubeInfo, YouTubeMode } from './types';

export const VIDEO_FORMATS = ['mp4', 'webm'] as const;
export const AUDIO_FORMATS = ['mp3', 'm4a', 'wav', 'opus'] as const;
const FALLBACK_BITRATES = [128, 192, 256, 320];
const DEFAULT_BITRATE = 192;

/** Bitrates the server offers for an audio format (none for lossless WAV). */
export function getBitrateOptions(info: YouTubeInfo | null, format: string): number[] {
  if (format === 'wav') return [];
  const match = info?.audioFormats.find((f) => f.format === format);
  if (match) return match.bitrates;
  return FALLBACK_BITRATES;
}

function pickBitrate(options: number[], current: number): number {
  if (options.length === 0 || options.includes(current)) return current;
  if (options.includes(DEFAULT_BITRATE)) return DEFAULT_BITRATE;
  return options[options.length - 1] ?? current;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/** Turn anything thrown by fetch/apiClient into an AppError the UI can render. */
export function toAppError(err: unknown, fallback: AppError): AppError {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    return err as AppError;
  }
  if (err instanceof TypeError) {
    // fetch() rejects with TypeError on network/CORS failures, e.g. a sleeping server.
    return {
      code: 'NETWORK_ERROR',
      message: "Couldn't reach the server. It may be waking up; try again in a moment.",
      retryable: true,
    };
  }
  return fallback;
}

// Monotonic tokens so late responses from superseded requests are ignored.
let infoRequestSeq = 0;
let infoController: AbortController | null = null;
let downloadSeq = 0;

interface YouTubeState {
  url: string;
  status: YouTubeFlowStatus;
  info: YouTubeInfo | null;
  mode: YouTubeMode;
  selectedQuality: number | null;
  selectedFormat: string;
  selectedBitrate: number;
  trimStart: string;
  trimEnd: string;
  embedThumbnail: boolean;
  embedMetadata: boolean;
  showAdvanced: boolean;
  currentJobId: string | null;
  /** Job whose finished result can be downloaded (kept after the job completes). */
  resultJobId: string | null;
  progress: number;
  stage: string | null;
  result: {
    filename: string;
    sizeBytes: number;
    mime: string;
    expiresAt: string;
    downloadToken?: string | null;
  } | null;
  error: AppError | null;

  // Actions
  setUrl: (url: string) => void;
  fetchInfo: (targetUrl?: string) => Promise<void>;
  setMode: (mode: YouTubeMode) => void;
  setQuality: (quality: number) => void;
  setFormat: (format: string) => void;
  setBitrate: (bitrate: number) => void;
  setTrimStart: (val: string) => void;
  setTrimEnd: (val: string) => void;
  setEmbedThumbnail: (val: boolean) => void;
  setEmbedMetadata: (val: boolean) => void;
  toggleAdvanced: () => void;
  startDownload: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  setProgress: (progress: number, stage: string | null) => void;
  setDone: (result: {
    filename: string;
    sizeBytes: number;
    mime: string;
    expiresAt: string;
    downloadToken?: string | null;
  }) => void;
  setError: (error: AppError) => void;
  /** Re-run whichever step failed: the download if info is loaded, else the info lookup. */
  retry: () => Promise<void>;
  /** Switch a loaded video to audio-only (used by the "too long" error). */
  chooseAudioOnly: () => void;
  /** Return from an error to the options card (if video details are loaded). */
  backToOptions: () => void;
  reset: () => void;
}

export const useYouTubeStore = create<YouTubeState>((set, get) => ({
  url: '',
  status: 'idle',
  info: null,
  mode: 'video',
  selectedQuality: null,
  selectedFormat: 'mp4',
  selectedBitrate: 192,
  trimStart: '',
  trimEnd: '',
  embedThumbnail: false,
  embedMetadata: false,
  showAdvanced: false,
  currentJobId: null,
  resultJobId: null,
  progress: 0,
  stage: null,
  result: null,
  error: null,

  setUrl: (url) => set({ url, error: null }),

  fetchInfo: async (targetUrl) => {
    const inputUrl = (targetUrl ?? get().url).trim();
    if (!inputUrl) return;

    const seq = ++infoRequestSeq;
    infoController?.abort();
    const controller = new AbortController();
    infoController = controller;

    set({
      status: 'fetching_info',
      error: null,
      url: inputUrl,
      info: null,
      result: null,
      resultJobId: null,
    });

    try {
      const info = await apiClient.getYoutubeInfo(inputUrl, controller.signal);
      if (seq !== infoRequestSeq) return;

      const heights = info.videoFormats.map((f) => f.height);
      const defaultQuality = heights.length > 0 ? Math.max(...heights) : 1080;

      set({
        status: 'info_ready',
        info,
        mode: info.tooLong ? 'audio' : 'video',
        selectedQuality: defaultQuality,
        selectedFormat: info.tooLong ? 'mp3' : 'mp4',
        selectedBitrate: pickBitrate(getBitrateOptions(info, 'mp3'), DEFAULT_BITRATE),
      });
    } catch (err: unknown) {
      if (seq !== infoRequestSeq || isAbortError(err)) return;
      const appErr = toAppError(err, {
        code: 'CONVERSION_FAILED',
        message: "Couldn't load this video's details. Please try again.",
      });
      set({ status: 'error', error: appErr, info: null });
    }
  },

  setMode: (mode) => {
    const { selectedFormat, selectedBitrate, info } = get();
    const allowed: readonly string[] = mode === 'audio' ? AUDIO_FORMATS : VIDEO_FORMATS;
    const nextFormat = allowed.includes(selectedFormat)
      ? selectedFormat
      : mode === 'audio'
        ? 'mp3'
        : 'mp4';
    set({
      mode,
      selectedFormat: nextFormat,
      selectedBitrate:
        mode === 'audio'
          ? pickBitrate(getBitrateOptions(info, nextFormat), selectedBitrate)
          : selectedBitrate,
    });
  },

  setQuality: (selectedQuality) => set({ selectedQuality }),

  setFormat: (selectedFormat) => {
    const { mode, info, selectedBitrate } = get();
    set({
      selectedFormat,
      selectedBitrate:
        mode === 'audio'
          ? pickBitrate(getBitrateOptions(info, selectedFormat), selectedBitrate)
          : selectedBitrate,
    });
  },

  setBitrate: (selectedBitrate) => set({ selectedBitrate }),

  setTrimStart: (trimStart) => set({ trimStart }),

  setTrimEnd: (trimEnd) => set({ trimEnd }),

  setEmbedThumbnail: (embedThumbnail) => set({ embedThumbnail }),

  setEmbedMetadata: (embedMetadata) => set({ embedMetadata }),

  toggleAdvanced: () => set((s) => ({ showAdvanced: !s.showAdvanced })),

  startDownload: async () => {
    const {
      url,
      mode,
      selectedFormat,
      selectedQuality,
      selectedBitrate,
      trimStart,
      trimEnd,
      embedThumbnail,
      embedMetadata,
    } = get();

    const seq = ++downloadSeq;
    set({
      status: 'queued',
      progress: 0,
      stage: null,
      error: null,
      result: null,
      resultJobId: null,
      currentJobId: null,
    });

    try {
      const { jobId } = await apiClient.createYoutubeJob({
        url,
        mode,
        format: selectedFormat,
        quality: mode === 'video' ? (selectedQuality ?? undefined) : undefined,
        bitrate:
          mode === 'audio' && selectedFormat !== 'wav' ? selectedBitrate : undefined,
        trimStart: trimStart.trim() || undefined,
        trimEnd: trimEnd.trim() || undefined,
        embedThumbnail,
        embedMetadata,
      });

      if (seq !== downloadSeq) {
        // The user cancelled (or restarted) while the job was being created.
        apiClient.cancelJob(jobId).catch(() => undefined);
        return;
      }
      set({ currentJobId: jobId });
    } catch (err: unknown) {
      if (seq !== downloadSeq) return;
      const appErr = toAppError(err, {
        code: 'CONVERSION_FAILED',
        message: 'Failed to start the download. Please try again.',
      });
      set({ status: 'error', error: appErr, currentJobId: null });
    }
  },

  cancelDownload: async () => {
    downloadSeq++;
    const { currentJobId } = get();
    set({
      status: 'info_ready',
      currentJobId: null,
      progress: 0,
      stage: null,
    });
    if (currentJobId) {
      try {
        await apiClient.cancelJob(currentJobId);
      } catch {
        // The job may already be finished or gone; nothing else to do.
      }
    }
  },

  setProgress: (progress, stage) => {
    const currentStatus = get().status;
    let nextStatus: YouTubeFlowStatus = currentStatus;
    if (stage === 'converting' || stage === 'finalizing') {
      nextStatus = 'converting';
    } else if (stage === 'downloading' || (currentStatus === 'queued' && progress > 0)) {
      nextStatus = 'downloading';
    }
    set({ progress, stage, status: nextStatus });
  },

  setDone: (result) =>
    set((state) => ({
      status: 'done',
      progress: 100,
      stage: null,
      result,
      resultJobId: state.currentJobId,
      currentJobId: null,
    })),

  setError: (error) =>
    set({
      status: 'error',
      error,
      currentJobId: null,
      progress: 0,
      stage: null,
    }),

  retry: async () => {
    const { info, fetchInfo, startDownload } = get();
    if (info) {
      await startDownload();
    } else {
      await fetchInfo();
    }
  },

  chooseAudioOnly: () => {
    if (!get().info) {
      get().reset();
      return;
    }
    get().setMode('audio');
    set({ status: 'info_ready', error: null, progress: 0, stage: null });
  },

  backToOptions: () => {
    if (!get().info) {
      get().reset();
      return;
    }
    set({ status: 'info_ready', error: null, progress: 0, stage: null });
  },

  reset: () => {
    infoRequestSeq++;
    downloadSeq++;
    infoController?.abort();
    infoController = null;
    set({
      url: '',
      status: 'idle',
      info: null,
      mode: 'video',
      selectedQuality: null,
      selectedFormat: 'mp4',
      selectedBitrate: 192,
      trimStart: '',
      trimEnd: '',
      embedThumbnail: false,
      embedMetadata: false,
      showAdvanced: false,
      currentJobId: null,
      resultJobId: null,
      progress: 0,
      stage: null,
      result: null,
      error: null,
    });
  },
}));
