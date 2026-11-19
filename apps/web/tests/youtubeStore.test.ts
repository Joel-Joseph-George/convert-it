import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useYouTubeStore } from '@/features/youtube/youtubeStore';
import { apiClient } from '@/features/server/apiClient';

vi.mock('@/features/server/apiClient', () => ({
  apiClient: {
    getYoutubeInfo: vi.fn(),
    createYoutubeJob: vi.fn(),
    cancelJob: vi.fn(),
    getDownloadUrl: vi.fn((id: string) => `http://test/download/${id}`),
  },
}));

describe('YouTube Store', () => {
  beforeEach(() => {
    useYouTubeStore.getState().reset();
    vi.clearAllMocks();
  });

  it('initializes in idle state', () => {
    const state = useYouTubeStore.getState();
    expect(state.status).toBe('idle');
    expect(state.info).toBeNull();
    expect(state.mode).toBe('video');
  });

  it('updates state upon successful fetchInfo', async () => {
    const mockInfo = {
      id: 'jNQXAC9IVRw',
      title: 'Me at the zoo',
      channel: 'jawed',
      durationSec: 19,
      durationFormatted: '00:19',
      thumbnailUrl: 'https://i.ytimg.com/vi/jNQXAC9IVRw/default.jpg',
      tooLong: false,
      maxDurationMin: 60,
      videoFormats: [
        { formatId: '137', height: 1080, note: '1080p', ext: 'mp4' },
        { formatId: '22', height: 720, note: '720p', ext: 'mp4' },
      ],
      audioFormats: [{ format: 'mp3', bitrates: [128, 192, 256, 320] }],
    };

    vi.mocked(apiClient.getYoutubeInfo).mockResolvedValueOnce(mockInfo);

    await useYouTubeStore
      .getState()
      .fetchInfo('https://www.youtube.com/watch?v=jNQXAC9IVRw');

    const state = useYouTubeStore.getState();
    expect(state.status).toBe('info_ready');
    expect(state.info?.title).toBe('Me at the zoo');
    expect(state.mode).toBe('video');
    expect(state.selectedQuality).toBe(1080);
    expect(state.selectedFormat).toBe('mp4');
  });

  it('automatically forces audio mode when video tooLong is true', async () => {
    const mockInfo = {
      id: 'longVideo123',
      title: 'Very Long Video',
      channel: 'channel',
      durationSec: 4000,
      durationFormatted: '01:06:40',
      tooLong: true,
      maxDurationMin: 60,
      videoFormats: [],
      audioFormats: [{ format: 'mp3', bitrates: [192] }],
    };

    vi.mocked(apiClient.getYoutubeInfo).mockResolvedValueOnce(mockInfo);

    await useYouTubeStore.getState().fetchInfo('https://youtu.be/longVideo123');

    const state = useYouTubeStore.getState();
    expect(state.status).toBe('info_ready');
    expect(state.mode).toBe('audio');
    expect(state.selectedFormat).toBe('mp3');
  });

  it('handles API errors gracefully during fetchInfo', async () => {
    vi.mocked(apiClient.getYoutubeInfo).mockRejectedValueOnce({
      code: 'VIDEO_UNAVAILABLE',
      message: 'This video is private or removed.',
    });

    await useYouTubeStore
      .getState()
      .fetchInfo('https://www.youtube.com/watch?v=private12345');

    const state = useYouTubeStore.getState();
    expect(state.status).toBe('error');
    expect(state.error?.code).toBe('VIDEO_UNAVAILABLE');
  });

  it('sets job ID and updates status on startDownload', async () => {
    vi.mocked(apiClient.createYoutubeJob).mockResolvedValueOnce({
      jobId: 'job_test_123',
    });

    useYouTubeStore.setState({
      url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      status: 'info_ready',
      mode: 'video',
      selectedFormat: 'mp4',
    });

    await useYouTubeStore.getState().startDownload();

    const state = useYouTubeStore.getState();
    expect(state.status).toBe('downloading');
    expect(state.currentJobId).toBe('job_test_123');
  });

  it('switches format appropriately when changing modes', () => {
    useYouTubeStore.setState({ mode: 'video', selectedFormat: 'mp4' });

    useYouTubeStore.getState().setMode('audio');
    expect(useYouTubeStore.getState().selectedFormat).toBe('mp3');

    useYouTubeStore.getState().setMode('video');
    expect(useYouTubeStore.getState().selectedFormat).toBe('mp4');
  });
});
