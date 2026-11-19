import { useSettingsStore } from '@/features/settings/settingsStore';
import type { AppError } from './errorToView';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export interface HealthResponse {
  status: string;
  version: string;
  uptimeSec: number;
  ytdlpVersion: string | null;
  queue: {
    running: number;
    queued: number;
  };
}

export interface LimitsResponse {
  maxUploadMB: number;
  ytMaxDurationMin: number;
  ytMaxFilesizeMB: number;
  ytMaxHeight: number;
  accessCodeRequired: boolean;
  youtubeEnabled: boolean;
  concurrency: {
    heavy: number;
    youtube: number;
    light: number;
  };
  maxQueueLength: number;
  serverTools?: Record<string, boolean>;
}

export interface YouTubeJobPayload {
  url: string;
  mode: 'video' | 'audio';
  format: string;
  quality?: number;
  bitrate?: number;
  trimStart?: string;
  trimEnd?: string;
  embedThumbnail?: boolean;
  embedMetadata?: boolean;
}

export interface JobSnapshotResponse {
  id: string;
  type: 'youtube' | 'convert';
  toolId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  stage: 'downloading' | 'converting' | 'finalizing' | null;
  progress: number;
  queuePosition: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: AppError | null;
  result: {
    filename: string;
    sizeBytes: number;
    mime: string;
    expiresAt: string;
  } | null;
}

export class ApiClientError extends Error implements AppError {
  code: string;
  retryable?: boolean;
  retryAfterSec?: number | null;
  details?: Record<string, unknown>;

  constructor(error: AppError) {
    super(error.message ?? 'An API error occurred');
    this.name = 'ApiClientError';
    this.code = error.code ?? 'CONVERSION_FAILED';
    this.retryable = error.retryable;
    this.retryAfterSec = error.retryAfterSec;
    this.details = error.details;
  }
}

export function getHeaders(contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  const accessCode = useSettingsStore.getState().accessCode;
  if (accessCode) {
    headers['X-Access-Code'] = accessCode;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorPayload: { error?: AppError } = {};
    try {
      errorPayload = (await res.json()) as { error?: AppError };
    } catch {
      // Body not JSON
    }
    const appErr: AppError = errorPayload.error ?? {
      code: res.status === 404 ? 'JOB_NOT_FOUND' : 'CONVERSION_FAILED',
      message: res.statusText || 'Request failed',
      retryable: res.status >= 500,
    };
    throw new ApiClientError(appErr);
  }
  return (await res.json()) as T;
}

export const apiClient = {
  async getHealth(signal?: AbortSignal): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      headers: getHeaders(),
      signal,
    });
    return handleResponse<HealthResponse>(res);
  },

  async getLimits(signal?: AbortSignal): Promise<LimitsResponse> {
    const res = await fetch(`${API_BASE_URL}/api/limits`, {
      headers: getHeaders(),
      signal,
    });
    return handleResponse<LimitsResponse>(res);
  },

  async getYoutubeInfo(
    url: string,
    signal?: AbortSignal
  ): Promise<import('../youtube/types').YouTubeInfo> {
    const res = await fetch(`${API_BASE_URL}/api/youtube/info`, {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify({ url }),
      signal,
    });
    return handleResponse<import('../youtube/types').YouTubeInfo>(res);
  },

  async createYoutubeJob(
    payload: YouTubeJobPayload,
    signal?: AbortSignal
  ): Promise<{ jobId: string }> {
    const res = await fetch(`${API_BASE_URL}/api/jobs/youtube`, {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(payload),
      signal,
    });
    return handleResponse<{ jobId: string }>(res);
  },

  async getJob(jobId: string, signal?: AbortSignal): Promise<JobSnapshotResponse> {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
      headers: getHeaders(),
      signal,
    });
    return handleResponse<JobSnapshotResponse>(res);
  },

  async cancelJob(jobId: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse<{ status: string }>(res);
  },

  getDownloadUrl(jobId: string): string {
    return `${API_BASE_URL}/api/jobs/${jobId}/download`;
  },
};
