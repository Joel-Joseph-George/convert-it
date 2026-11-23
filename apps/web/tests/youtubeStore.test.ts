import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBitrateOptions, useYouTubeStore } from '@/features/youtube/youtubeStore';
import type { YouTubeInfo } from '@/features/youtube/types';

const baseInfo: YouTubeInfo = {
  id: 'jNQXAC9IVRw',
  title: 'Me at the zoo',
  channel: 'jawed',
  durationSec: 19,
  durationFormatted: '00:19',
  tooLong: false,
  maxDurationMin: 60,
  videoFormats: [{ formatId: '18', height: 360, note: '360p', ext: 'mp4' }],
  audioFormats: [
    { format: 'mp3', bitrates: [128, 192, 256, 320] },
    { format: 'opus', bitrates: [128, 160] },
    { format: 'wav', bitrates: [] },
  ],
};
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
    // Stays queued until the server reports progress.
    expect(state.status).toBe('queued');
    expect(state.currentJobId).toBe('job_test_123');

    useYouTubeStore.getState().setProgress(10, 'downloading');
    expect(useYouTubeStore.getState().status).toBe('downloading');
  });

  it('switches format appropriately when changing modes', () => {
    useYouTubeStore.setState({ mode: 'video', selectedFormat: 'mp4' });

    useYouTubeStore.getState().setMode('audio');
    expect(useYouTubeStore.getState().selectedFormat).toBe('mp3');

    useYouTubeStore.getState().setMode('video');
    expect(useYouTubeStore.getState().selectedFormat).toBe('mp4');
  });

  it('maps every audio-only format back to mp4 in video mode', () => {
    useYouTubeStore.setState({ mode: 'audio', selectedFormat: 'opus' });
    useYouTubeStore.getState().setMode('video');
    expect(useYouTubeStore.getState().selectedFormat).toBe('mp4');
  });

  it('keeps the finished job id so the result can be downloaded', () => {
    useYouTubeStore.setState({ status: 'downloading', currentJobId: 'job_abc' });
    useYouTubeStore.getState().setDone({
      filename: 'a.mp4',
      sizeBytes: 1,
      mime: 'video/mp4',
      expiresAt: '2999-01-01T00:00:00Z',
    });
    const state = useYouTubeStore.getState();
    expect(state.status).toBe('done');
    expect(state.currentJobId).toBeNull();
    expect(state.resultJobId).toBe('job_abc');
  });

  it('reports network failures as NETWORK_ERROR, not an invalid link', async () => {
    vi.mocked(apiClient.getYoutubeInfo).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await useYouTubeStore.getState().fetchInfo('https://youtu.be/jNQXAC9IVRw');
    const state = useYouTubeStore.getState();
    expect(state.status).toBe('error');
    expect(state.error?.code).toBe('NETWORK_ERROR');
    // The link is kept so Retry can use it.
    expect(state.url).toBe('https://youtu.be/jNQXAC9IVRw');
  });

  it('ignores a stale info response that arrives after a newer request', async () => {
    let resolveFirst: (v: unknown) => void = () => undefined;
    vi.mocked(apiClient.getYoutubeInfo)
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)) as never)
      .mockResolvedValueOnce({ ...baseInfo, title: 'Second' });

    const first = useYouTubeStore.getState().fetchInfo('https://youtu.be/aaaaaaaaaaa');
    await useYouTubeStore.getState().fetchInfo('https://youtu.be/bbbbbbbbbbb');
    resolveFirst({ ...baseInfo, title: 'First' });
    await first;

    expect(useYouTubeStore.getState().info?.title).toBe('Second');
  });

  it('cancels the server job if the user cancelled while it was being created', async () => {
    let resolveCreate: (v: { jobId: string }) => void = () => undefined;
    vi.mocked(apiClient.createYoutubeJob).mockImplementationOnce(
      () => new Promise((r) => (resolveCreate = r))
    );
    vi.mocked(apiClient.cancelJob).mockResolvedValue({ status: 'cancelled' });
    useYouTubeStore.setState({ url: 'https://youtu.be/jNQXAC9IVRw', info: baseInfo });

    const pending = useYouTubeStore.getState().startDownload();
    await useYouTubeStore.getState().cancelDownload();
    resolveCreate({ jobId: 'job_orphan' });
    await pending;

    expect(apiClient.cancelJob).toHaveBeenCalledWith('job_orphan');
    expect(useYouTubeStore.getState().currentJobId).toBeNull();
    expect(useYouTubeStore.getState().status).toBe('info_ready');
  });

  it('retry re-runs the download when video info is loaded', async () => {
    vi.mocked(apiClient.createYoutubeJob).mockResolvedValueOnce({ jobId: 'job_retry' });
    useYouTubeStore.setState({
      url: 'https://youtu.be/jNQXAC9IVRw',
      info: baseInfo,
      status: 'error',
      error: { code: 'UPSTREAM_BLOCKED' },
    });
    await useYouTubeStore.getState().retry();
    expect(apiClient.createYoutubeJob).toHaveBeenCalledTimes(1);
    expect(useYouTubeStore.getState().currentJobId).toBe('job_retry');
  });

  it('only offers the bitrates the server lists for a format', () => {
    expect(getBitrateOptions(baseInfo, 'opus')).toEqual([128, 160]);
    expect(getBitrateOptions(baseInfo, 'wav')).toEqual([]);
    useYouTubeStore.setState({ info: baseInfo, mode: 'audio', selectedBitrate: 320 });
    useYouTubeStore.getState().setFormat('opus');
    expect(useYouTubeStore.getState().selectedBitrate).toBe(160);
  });
});
