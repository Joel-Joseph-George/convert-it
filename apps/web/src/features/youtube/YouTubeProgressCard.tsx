import React from 'react';
import { StatusPill } from '@/components/shared/StatusPill';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Button } from '@/components/ui/button';
import { useYouTubeStore } from './youtubeStore';
import { useJobEvents } from '../server/useJobEvents';

export const YouTubeProgressCard: React.FC = () => {
  const {
    info,
    status,
    progress,
    stage,
    currentJobId,
    mode,
    selectedFormat,
    setProgress,
    setDone,
    setError,
    cancelDownload,
  } = useYouTubeStore();

  useJobEvents({
    jobId: currentJobId,
    onProgress: (prog, stg) => setProgress(prog, stg),
    onDone: (result) => setDone(result),
    onError: (err) => setError(err),
  });

  if (!info || (status !== 'downloading' && status !== 'converting' && status !== 'queued')) {
    return null;
  }

  const isConverting = status === 'converting' || stage === 'converting' || stage === 'finalizing';
  const statusLabel = isConverting
    ? `Transcoding to ${selectedFormat.toUpperCase()}...`
    : status === 'queued'
    ? 'Queued...'
    : 'Downloading from YouTube...';

  return (
    <div className="w-full bg-surface border border-border rounded-card p-5 sm:p-6 mb-8 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StatusPill status="converting" customLabel={statusLabel} />
        </div>
        <span className="font-mono text-xs font-semibold text-text">
          {progress}%
        </span>
      </div>

      <div className="mb-4">
        <h3 className="text-sm sm:text-base font-semibold text-text line-clamp-1 mb-1">
          {info.title}
        </h3>
        <p className="text-xs text-text-muted">
          {mode === 'audio' ? 'Audio stream extraction' : 'Video stream download'}
        </p>
      </div>

      <div className="mb-6">
        <ProgressBar progress={progress} />
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={cancelDownload}
          className="h-8 px-4 text-xs font-sans text-text-muted hover:text-text hover:border-red-500/50"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};
