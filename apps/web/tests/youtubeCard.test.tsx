import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useYouTubeStore } from '@/features/youtube/youtubeStore';
import { YouTubeResultCard } from '@/features/youtube/YouTubeResultCard';
import { YouTubeProgressCard } from '@/features/youtube/YouTubeProgressCard';
import { YouTubeDoneCard } from '@/features/youtube/YouTubeDoneCard';
import { ServerWakeBanner } from '@/features/server/ServerWakeBanner';

describe('YouTube UI Components', () => {
  beforeEach(() => {
    useYouTubeStore.getState().reset();
  });

  it('renders ServerWakeBanner with correct message and role', () => {
    render(<ServerWakeBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(
      screen.getByText(/waking up the server, this can take up to a minute/i)
    ).toBeInTheDocument();
  });

  it('renders YouTubeResultCard with formats, title, and toggles mode', () => {
    useYouTubeStore.setState({
      status: 'info_ready',
      mode: 'video',
      info: {
        id: 'jNQXAC9IVRw',
        title: 'Me at the zoo',
        channel: 'jawed',
        durationSec: 19,
        durationFormatted: '00:19',
        thumbnailUrl: 'https://i.ytimg.com/vi/jNQXAC9IVRw/default.jpg',
        viewCount: 300000000,
        tooLong: false,
        maxDurationMin: 60,
        videoFormats: [
          { formatId: '137', height: 1080, note: '1080p', ext: 'mp4' },
          { formatId: '22', height: 720, note: '720p', ext: 'mp4' },
        ],
        audioFormats: [
          { format: 'mp3', bitrates: [128, 192, 256, 320] },
          { format: 'm4a', bitrates: [128, 192] },
        ],
      },
    });

    render(<YouTubeResultCard />);
    expect(screen.getByText('Me at the zoo')).toBeInTheDocument();
    expect(screen.getByText(/jawed/)).toBeInTheDocument();

    // Mode buttons exist
    const audioBtn = screen.getByRole('button', { name: /audio only/i });
    expect(audioBtn).toBeInTheDocument();

    fireEvent.click(audioBtn);
    expect(useYouTubeStore.getState().mode).toBe('audio');
    expect(screen.getByText('MP3')).toBeInTheDocument();
  });

  it('renders YouTubeProgressCard with progress bar and stage', () => {
    useYouTubeStore.setState({
      status: 'downloading',
      progress: 45,
      stage: 'downloading',
      info: {
        id: 'jNQXAC9IVRw',
        title: 'Me at the zoo',
        channel: 'jawed',
        durationSec: 19,
        durationFormatted: '00:19',
        tooLong: false,
        maxDurationMin: 60,
        videoFormats: [],
        audioFormats: [],
      },
    });

    render(<YouTubeProgressCard />);
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText(/downloading from youtube/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders YouTubeDoneCard with complete status and save button', () => {
    useYouTubeStore.setState({
      status: 'done',
      currentJobId: 'job_done_999',
      result: {
        filename: 'Me_at_the_zoo.mp4',
        sizeBytes: 12450000,
        mime: 'video/mp4',
        expiresAt: '2026-02-19T07:00:00Z',
      },
    });

    render(<YouTubeDoneCard />);
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Me_at_the_zoo.mp4')).toBeInTheDocument();
    expect(screen.getByText('11.9 MB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download another/i })).toBeInTheDocument();
  });
});
