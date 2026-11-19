import { create } from 'zustand';
import { apiClient } from '../server/apiClient';
import type { AppError } from '../server/errorToView';
import type { YouTubeFlowStatus, YouTubeInfo, YouTubeMode } from './types';

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
  progress: number;
  stage: string | null;
  result: {
    filename: string;
    sizeBytes: number;
    mime: string;
    expiresAt: string;
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
  }) => void;
  setError: (error: AppError) => void;
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
  progress: 0,
  stage: null,
  result: null,
  error: null,

  setUrl: (url) => set({ url, error: null }),

  fetchInfo: async (targetUrl) => {
    const inputUrl = targetUrl ?? get().url;
    if (!inputUrl.trim()) return;

    set({ status: 'fetching_info', error: null, url: inputUrl });

    try {
      const info = await apiClient.getYoutubeInfo(inputUrl);
      const defaultQuality =
        info.videoFormats.length > 0 && info.videoFormats[0]
          ? info.videoFormats[0].height
          : 1080;

      set({
        status: 'info_ready',
        info,
        mode: info.tooLong ? 'audio' : 'video',
        selectedQuality: defaultQuality,
        selectedFormat: info.tooLong ? 'mp3' : 'mp4',
        selectedBitrate: 192,
      });
    } catch (err: unknown) {
      const appErr =
        err && typeof err === 'object' && 'code' in err
          ? (err as AppError)
          : {
              code: 'INVALID_URL',
              message: "That doesn't look like a valid YouTube link",
            };
      set({ status: 'error', error: appErr, info: null });
    }
  },

  setMode: (mode) => {
    const currentFormat = get().selectedFormat;
    let nextFormat = currentFormat;
    if (mode === 'audio' && (currentFormat === 'mp4' || currentFormat === 'webm')) {
      nextFormat = 'mp3';
    } else if (
      mode === 'video' &&
      (currentFormat === 'mp3' || currentFormat === 'm4a' || currentFormat === 'wav')
    ) {
      nextFormat = 'mp4';
    }
    set({ mode, selectedFormat: nextFormat });
  },

  setQuality: (selectedQuality) => set({ selectedQuality }),

  setFormat: (selectedFormat) => set({ selectedFormat }),

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

    set({
      status: 'downloading',
      progress: 0,
      stage: 'downloading',
      error: null,
      result: null,
    });

    try {
      const { jobId } = await apiClient.createYoutubeJob({
        url,
        mode,
        format: selectedFormat,
        quality: selectedQuality ?? undefined,
        bitrate: mode === 'audio' ? selectedBitrate : undefined,
        trimStart: trimStart.trim() || undefined,
        trimEnd: trimEnd.trim() || undefined,
        embedThumbnail,
        embedMetadata,
      });

      set({ currentJobId: jobId });
    } catch (err: unknown) {
      const appErr =
        err && typeof err === 'object' && 'code' in err
          ? (err as AppError)
          : { code: 'CONVERSION_FAILED', message: 'Failed to start download job' };
      set({ status: 'error', error: appErr, currentJobId: null });
    }
  },

  cancelDownload: async () => {
    const { currentJobId } = get();
    if (currentJobId) {
      try {
        await apiClient.cancelJob(currentJobId);
      } catch {
        // Ignore cancel errors
      }
    }
    set({
      status: 'info_ready',
      currentJobId: null,
      progress: 0,
      stage: null,
    });
  },

  setProgress: (progress, stage) => {
    const currentStatus = get().status;
    let nextStatus: YouTubeFlowStatus = currentStatus;
    if (stage === 'converting') {
      nextStatus = 'converting';
    } else if (stage === 'downloading') {
      nextStatus = 'downloading';
    }
    set({ progress, stage, status: nextStatus });
  },

  setDone: (result) =>
    set({
      status: 'done',
      progress: 100,
      stage: null,
      result,
      currentJobId: null,
    }),

  setError: (error) =>
    set({
      status: 'error',
      error,
      currentJobId: null,
      progress: 0,
      stage: null,
    }),

  reset: () =>
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
      progress: 0,
      stage: null,
      result: null,
      error: null,
    }),
}));
