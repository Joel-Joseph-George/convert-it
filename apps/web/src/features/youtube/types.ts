export interface VideoFormatOption {
  formatId: string;
  height: number;
  note: string;
  ext: string;
  filesizeApproxMB?: number | null;
}

export interface AudioFormatOption {
  format: string;
  bitrates: number[];
}

export interface YouTubeInfo {
  id: string;
  title: string;
  channel: string;
  durationSec: number;
  durationFormatted: string;
  thumbnailUrl?: string | null;
  viewCount?: number | null;
  uploadDate?: string | null;
  tooLong: boolean;
  maxDurationMin: number;
  videoFormats: VideoFormatOption[];
  audioFormats: AudioFormatOption[];
}

export type YouTubeMode = 'video' | 'audio';

export type YouTubeFlowStatus =
  | 'idle'
  | 'fetching_info'
  | 'info_ready'
  | 'queued'
  | 'downloading'
  | 'converting'
  | 'done'
  | 'error';
