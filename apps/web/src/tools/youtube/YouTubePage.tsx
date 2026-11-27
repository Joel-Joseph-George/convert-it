import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { UrlInput } from '@/components/youtube/UrlInput';
import { EngineBadge } from '@/components/shared/EngineBadge';
import { PrivacyLine } from '@/components/shared/PrivacyLine';
import { ErrorAlert } from '@/components/shared/ErrorAlert';
import { useServerHealth } from '@/features/server/useServerHealth';
import { ServerWakeBanner } from '@/features/server/ServerWakeBanner';
import { useYouTubeStore } from '@/features/youtube/youtubeStore';
import { YouTubeSkeleton } from '@/features/youtube/YouTubeSkeleton';
import { YouTubeResultCard } from '@/features/youtube/YouTubeResultCard';
import { YouTubeProgressCard } from '@/features/youtube/YouTubeProgressCard';
import { YouTubeDoneCard } from '@/features/youtube/YouTubeDoneCard';

/** YouTube download flow. This used to be the home page hero. */
export default function YouTubePage(): React.ReactElement {
  const { isWakingUp, serverError, limits, retry: retryHealth } = useServerHealth();
  const status = useYouTubeStore((s) => s.status);
  const error = useYouTubeStore((s) => s.error);
  const url = useYouTubeStore((s) => s.url);
  const setUrl = useYouTubeStore((s) => s.setUrl);
  const fetchInfo = useYouTubeStore((s) => s.fetchInfo);
  const retry = useYouTubeStore((s) => s.retry);
  const chooseAudioOnly = useYouTubeStore((s) => s.chooseAudioOnly);
  const backToOptions = useYouTubeStore((s) => s.backToOptions);
  const reset = useYouTubeStore((s) => s.reset);

  const handleErrorAction = (actionKind?: string): void => {
    if (actionKind === 'retry') {
      void retry();
    } else if (actionKind === 'audio-only') {
      chooseAudioOnly();
    } else if (actionKind === 'options') {
      backToOptions();
    } else {
      reset();
    }
  };

  const youtubeEnabled = limits ? limits.youtubeEnabled : true;

  return (
    <div className="mx-auto max-w-content space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          to="/tools"
          search={{ q: '', category: 'video' }}
          className="flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Tools</span>
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">Video</span>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            YouTube downloader
          </h1>
          <EngineBadge engine="server" />
        </div>
        <p className="text-sm text-muted-foreground">
          Paste a YouTube link to download the video or just the audio.
        </p>
        <PrivacyLine engine="server" />
      </div>

      {isWakingUp && <ServerWakeBanner />}

      {serverError && (
        <ErrorAlert
          error={{
            code: 'SERVER_OFFLINE',
            message: 'The server is not responding. Please check your connection or try again later.',
            retryable: true,
          }}
          onAction={retryHealth}
        />
      )}

      {youtubeEnabled ? (
        <div className="space-y-6">
          <UrlInput
            value={url}
            onValueChange={setUrl}
            isLoading={status === 'fetching_info'}
            onFetch={(nextUrl) => fetchInfo(nextUrl)}
          />

          {status === 'fetching_info' && <YouTubeSkeleton />}
          {status === 'info_ready' && <YouTubeResultCard />}
          {(status === 'downloading' || status === 'converting' || status === 'queued') && (
            <YouTubeProgressCard />
          )}
          {status === 'done' && <YouTubeDoneCard />}
          {status === 'error' && error && <ErrorAlert error={error} onAction={handleErrorAction} />}
        </div>
      ) : (
        <div className="rounded-card border border-border bg-card p-4 text-center text-xs text-muted-foreground">
          YouTube media downloading is currently disabled on this instance.
        </div>
      )}
    </div>
  );
}
