import * as React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ShieldCheck, Upload } from 'lucide-react';
import { UrlInput } from '@/components/youtube/UrlInput';
import { PopularToolsStrip } from '@/components/tool/PopularToolsStrip';
import { useServerHealth } from '@/features/server/useServerHealth';
import { ServerWakeBanner } from '@/features/server/ServerWakeBanner';
import { ErrorAlert } from '@/components/shared/ErrorAlert';
import { useYouTubeStore } from '@/features/youtube/youtubeStore';
import { YouTubeSkeleton } from '@/features/youtube/YouTubeSkeleton';
import { YouTubeResultCard } from '@/features/youtube/YouTubeResultCard';
import { YouTubeProgressCard } from '@/features/youtube/YouTubeProgressCard';
import { YouTubeDoneCard } from '@/features/youtube/YouTubeDoneCard';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage(): React.ReactElement {
  const navigate = useNavigate();
  const { isWakingUp, serverError, limits } = useServerHealth();
  const { status, error, fetchInfo, reset } = useYouTubeStore();

  const youtubeEnabled = limits ? limits.youtubeEnabled : true;

  const handleQuickDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    navigate({ to: '/tools' });
  };

  return (
    <div className="mx-auto max-w-content space-y-10">
      {/* Wake-up banner when server takes > 3s to respond */}
      {isWakingUp && <ServerWakeBanner />}

      {/* Offline error if server does not respond within 90s */}
      {serverError && (
        <ErrorAlert
          error={{
            code: 'SERVER_OFFLINE',
            message: 'The server is not responding. Please check your connection or try again later.',
            retryable: true,
          }}
        />
      )}

      {/* Hero Section */}
      <div className="space-y-4 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span>FREE</span>
          <span>•</span>
          <span>NO ADS</span>
          <span>•</span>
          <span>NO SIGN-UP</span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
          Paste a link. Convert it.
        </h1>

        <p className="text-base text-muted-foreground max-w-md mx-auto">
          {youtubeEnabled
            ? 'Download YouTube videos or audio, or convert any file right in your browser.'
            : 'Convert any file between audio, video, image, PDF, and data formats directly in your browser.'}
        </p>
      </div>

      {/* YouTube Flow or Disabled Notice */}
      {youtubeEnabled ? (
        <div className="space-y-6">
          <UrlInput
            isLoading={status === 'fetching_info'}
            onFetch={(url) => fetchInfo(url)}
          />

          {status === 'fetching_info' && <YouTubeSkeleton />}
          {status === 'info_ready' && <YouTubeResultCard />}
          {(status === 'downloading' ||
            status === 'converting' ||
            status === 'queued') && <YouTubeProgressCard />}
          {status === 'done' && <YouTubeDoneCard />}
          {status === 'error' && error && (
            <ErrorAlert error={error} onAction={reset} />
          )}
        </div>
      ) : (
        <div className="p-4 rounded-card border border-border bg-card text-center text-xs text-muted-foreground">
          YouTube media downloading is currently disabled on this instance.
        </div>
      )}

      {/* Quick Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleQuickDrop}
        onClick={() => navigate({ to: '/tools' })}
        className="group flex cursor-pointer flex-col items-center justify-center rounded-card border border-dashed border-border-dashed bg-card/60 p-8 text-center transition-colors hover:border-primary/50 hover:bg-card"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-btn bg-primary/10 text-primary">
          <Upload className="h-5 w-5 stroke-[1.75]" />
        </div>
        <p className="mt-3 text-sm font-medium text-foreground">
          Drop any local file here to transcode
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Privacy-guaranteed • Computations execute locally on device WebAssembly
        </p>
      </div>

      {/* Popular Tools Strip generated from registry */}
      <PopularToolsStrip />

      {/* Private by Architecture Callout */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-card border border-border bg-card p-4 sm:p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Private by Architecture</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            Zero data uploads for documents and conversions. Everything converts on your CPU utilizing WebAssembly and client-side memory.
          </p>
        </div>

        <div className="flex items-center gap-2 text-center text-xs w-full sm:w-auto">
          <div className="flex-1 sm:flex-initial rounded-btn border border-border bg-muted px-3 py-2">
            <div className="font-semibold text-foreground">100%</div>
            <div className="text-[10px] text-muted-foreground">In-Memory</div>
          </div>
          <div className="flex-1 sm:flex-initial rounded-btn border border-border bg-muted px-3 py-2">
            <div className="font-semibold text-foreground">0 bps</div>
            <div className="text-[10px] text-muted-foreground">Telemetry</div>
          </div>
        </div>
      </div>
    </div>
  );
}
