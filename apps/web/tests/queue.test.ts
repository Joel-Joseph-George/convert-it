import { describe, it, expect, beforeEach } from 'vitest';
import { useQueueStore } from '@/features/queue/queueStore';

describe('Queue Store State Machine', () => {
  beforeEach(() => {
    useQueueStore.setState({ items: {}, selectedFormat: {}, options: {} });
  });

  it('adds files with initial status "ready" and progress 0', () => {
    const file = new File(['test'], 'test.mp3', { type: 'audio/mpeg' });
    useQueueStore.getState().addFiles('audio-convert', [file], 'wav');

    const items = useQueueStore.getState().items['audio-convert'];
    expect(items).toBeDefined();
    expect(items?.length).toBe(1);
    expect(items?.[0]?.status).toBe('ready');
    expect(items?.[0]?.progress).toBe(0);
    expect(items?.[0]?.targetFormat).toBe('wav');
  });

  it('caps items batch at 20 files as required by spec', () => {
    const files = Array.from({ length: 25 }, (_, i) =>
      new File(['test'], `file${i}.mp3`, { type: 'audio/mpeg' })
    );
    useQueueStore.getState().addFiles('audio-convert', files, 'wav');

    const items = useQueueStore.getState().items['audio-convert'];
    expect(items?.length).toBe(20);
  });

  it('removes item and clears queue properly', () => {
    const file1 = new File(['1'], 'file1.mp3', { type: 'audio/mpeg' });
    const file2 = new File(['2'], 'file2.mp3', { type: 'audio/mpeg' });
    useQueueStore.getState().addFiles('audio-convert', [file1, file2], 'wav');

    let items = useQueueStore.getState().items['audio-convert'] ?? [];
    const firstItem = items[0];
    expect(firstItem).toBeDefined();
    if (!firstItem) return;

    useQueueStore.getState().removeItem('audio-convert', firstItem.id);

    items = useQueueStore.getState().items['audio-convert'] ?? [];
    expect(items.length).toBe(1);
    expect(items[0]?.file.name).toBe('file2.mp3');

    useQueueStore.getState().clearQueue('audio-convert');
    expect(useQueueStore.getState().items['audio-convert']).toEqual([]);
  });

  it('updates target format and updates pending items', () => {
    const file = new File(['test'], 'file.mp3', { type: 'audio/mpeg' });
    useQueueStore.getState().addFiles('audio-convert', [file], 'wav');

    useQueueStore.getState().setTargetFormat('audio-convert', 'flac');
    const items = useQueueStore.getState().items['audio-convert'] ?? [];
    expect(useQueueStore.getState().selectedFormat['audio-convert']).toBe('flac');
    expect(items[0]?.targetFormat).toBe('flac');
  });

  it('manages tool options correctly', () => {
    useQueueStore.getState().setOption('image-convert', 'quality', 95);
    const opts = useQueueStore.getState().options['image-convert'];
    expect(opts?.['quality']).toBe(95);
  });
});
