import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useQueueStore } from '@/features/queue/queueStore';
import * as serverConversionModule from '@/features/server/serverConversion';
import { dedupeZipNames } from '@/features/engines/zipUtil';

const TOOL = 'pdf-to-word';

function itemId(name: string): string {
  const item = useQueueStore.getState().items[TOOL]?.find((i) => i.file.name === name);
  if (!item) throw new Error(`no queue item ${name}`);
  return item.id;
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const result = (name: string) => ({
  filename: name.replace('.pdf', '.docx'),
  blob: new Blob(['x']),
  sizeBytes: 1,
});

describe('queue batch behaviour (#8)', () => {
  beforeEach(() => {
    useQueueStore.setState({ items: {}, selectedFormat: {}, options: {} });
    const files = ['a.pdf', 'b.pdf', 'c.pdf'].map((n) => new File(['%PDF'], n));
    useQueueStore.getState().addFiles(TOOL, files, 'docx');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips items removed while the batch is running', async () => {
    const first = deferred<ReturnType<typeof result>>();
    const spy = vi
      .spyOn(serverConversionModule, 'runServerConversion')
      .mockImplementation(async (_t, file) => (file.name === 'a.pdf' ? first.promise : result(file.name)));

    const run = useQueueStore.getState().startConversion(TOOL);
    useQueueStore.getState().removeItem(TOOL, itemId('b.pdf'));
    first.resolve(result('a.pdf'));
    await run;

    expect(spy.mock.calls.map((c) => c[1].name)).toEqual(['a.pdf', 'c.pdf']);
  });

  it('retrying a failed row during a batch does not convert other rows twice', async () => {
    const second = deferred<ReturnType<typeof result>>();
    let aCalls = 0;
    const spy = vi
      .spyOn(serverConversionModule, 'runServerConversion')
      .mockImplementation(async (_t, file) => {
        if (file.name === 'a.pdf') {
          aCalls += 1;
          if (aCalls === 1) throw new Error('boom');
          return result(file.name);
        }
        if (file.name === 'b.pdf') return second.promise;
        return result(file.name);
      });

    const run = useQueueStore.getState().startConversion(TOOL);
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2)); // a failed, b running
    const a = useQueueStore.getState().items[TOOL]?.find((i) => i.file.name === 'a.pdf');
    expect(a?.status).toBe('failed');

    useQueueStore.getState().retryItem(TOOL, itemId('a.pdf'));
    second.resolve(result('b.pdf'));
    await run;
    await vi.waitFor(() =>
      expect(useQueueStore.getState().items[TOOL]?.every((i) => i.status === 'done')).toBe(true)
    );

    const names = spy.mock.calls.map((c) => c[1].name).sort();
    expect(names).toEqual(['a.pdf', 'a.pdf', 'b.pdf', 'c.pdf']);
  });

  it('a second startConversion while running is a no-op', async () => {
    const spy = vi
      .spyOn(serverConversionModule, 'runServerConversion')
      .mockImplementation(async (_t, file) => result(file.name));

    await Promise.all([
      useQueueStore.getState().startConversion(TOOL),
      useQueueStore.getState().startConversion(TOOL),
    ]);
    expect(spy).toHaveBeenCalledTimes(3);
  });
});

describe('dedupeZipNames (#8)', () => {
  it('suffixes duplicates across the whole batch', () => {
    expect(dedupeZipNames(['a.webp', 'a.webp', 'A.webp', 'b.webp', 'a (1).webp', 'noext', 'noext'])).toEqual([
      'a.webp',
      'a (1).webp',
      'A (2).webp',
      'b.webp',
      'a (1) (1).webp',
      'noext',
      'noext (1)',
    ]);
  });
});
