import React from 'react';
import { CheckCircle2, Download, RefreshCw } from 'lucide-react';
import { StatusPill } from '@/components/shared/StatusPill';
import { Button } from '@/components/ui/button';
import { apiClient } from '../server/apiClient';
import { useYouTubeStore } from './youtubeStore';

export const YouTubeDoneCard: React.FC = () => {
  const { status, result, currentJobId, reset } = useYouTubeStore();

  if (status !== 'done' || !result) return null;

  const formattedSize =
    result.sizeBytes > 1024 * 1024
      ? `${(result.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(result.sizeBytes / 1024)} KB`;

  const handleSaveFile = () => {
    if (currentJobId) {
      window.location.href = apiClient.getDownloadUrl(currentJobId);
    }
  };

  return (
    <div className="w-full bg-surface border border-border rounded-card p-5 sm:p-6 mb-8 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <StatusPill status="done" customLabel="Complete" />
        <span className="text-xs text-text-muted font-mono">
          Available for 15 minutes
        </span>
      </div>

      <div className="flex items-center gap-3 p-3.5 rounded-lg bg-bg border border-border mb-6">
        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text truncate">
            {result.filename}
          </p>
          <p className="text-xs text-text-muted font-mono">{formattedSize}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button
          onClick={handleSaveFile}
          className="w-full sm:w-auto px-6 h-10 font-sans font-medium flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Save file
        </Button>

        <Button
          variant="outline"
          onClick={reset}
          className="w-full sm:w-auto h-10 text-xs font-sans text-text-muted hover:text-text flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Download another
        </Button>
      </div>
    </div>
  );
};
