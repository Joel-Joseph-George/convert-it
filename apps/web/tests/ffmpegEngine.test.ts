import { describe, it, expect, vi, beforeEach } from 'vitest';

type Listener = (e: { progress: number }) => void;
const instances: FakeFFmpeg[] = [];
let failLoads = 0;

class FakeFFmpeg {
  listeners: Listener[] = [];
  terminated = false;
  pendingExec: { reject: (e: unknown) => void; resolve: (c: number) => void } | null = null;
  constructor() {
    instances.push(this);
  }
  on(_ev: string, cb: Listener) {
    this.listeners.push(cb);
  }
  emit(progress: number) {
    this.listeners.forEach((l) => l({ progress }));
  }
  load = vi.fn(async () => {
    if (failLoads > 0) {
      failLoads -= 1;
      throw new Error('network');
    }
    return true;
  });
  writeFile = vi.fn(async () => true);
  readFile = vi.fn(async () => new Uint8Array([1, 2, 3]));
  deleteFile = vi.fn(async () => true);
  exec = vi.fn(
    () =>
      new Promise<number>((resolve, reject) => {
        this.pendingExec = { resolve, reject };
      })
  );
  terminate = vi.fn(() => {
    this.terminated = true;
    this.pendingExec?.reject(new Error('called FFmpeg.terminate()'));
  });
}

vi.mock('@ffmpeg/ffmpeg', () => ({ FFmpeg: FakeFFmpeg }));
vi.mock('@ffmpeg/util', () => ({
  fetchFile: async () => new Uint8Array([0]),
  toBlobURL: async (u: string) => u,
}));

async function load() {
  vi.resetModules();
  return import('@/features/engines/ffmpegEngine');
}

const file = (n: string) => new File(['x'], n);

function inst(i: number): FakeFFmpeg {
  const instance = instances[i];
  if (!instance) throw new Error(`no FFmpeg instance ${i}`);
  return instance;
}

function finishExec(i: number): void {
  const pending = inst(i).pendingExec;
  if (!pending) throw new Error('no exec running');
  pending.resolve(0);
}

describe('ffmpeg engine (#7)', () => {
  beforeEach(() => {
    instances.length = 0;
    failLoads = 0;
  });

  it('shares one instance across concurrent jobs', async () => {
    const { ffmpegAudioEngine } = await load();
    const p1 = ffmpegAudioEngine.run([file('a.wav')], {}, 'mp3', { onProgress: () => {} });
    const p2 = ffmpegAudioEngine.run([file('b.wav')], {}, 'mp3', { onProgress: () => {} });
    await vi.waitFor(() => expect(instances[0]?.pendingExec).toBeTruthy());
    finishExec(0);
    await vi.waitFor(() => expect(instances[0]?.exec).toHaveBeenCalledTimes(2));
    finishExec(0);
    await Promise.all([p1, p2]);
    expect(instances).toHaveLength(1);
  });

  it('routes progress to the job that is running', async () => {
    const { ffmpegAudioEngine } = await load();
    const first = vi.fn();
    const second = vi.fn();
    const p1 = ffmpegAudioEngine.run([file('a.wav')], {}, 'mp3', { onProgress: first });
    await vi.waitFor(() => expect(instances[0]?.pendingExec).toBeTruthy());
    finishExec(0);
    await p1;

    const p2 = ffmpegAudioEngine.run([file('b.wav')], {}, 'mp3', { onProgress: second });
    await vi.waitFor(() => expect(instances[0]?.exec).toHaveBeenCalledTimes(2));
    inst(0).emit(0.5);
    finishExec(0);
    await p2;

    expect(second).toHaveBeenCalledWith(50);
    expect(first).not.toHaveBeenCalled();
  });

  it('abort terminates the running transcode and the next job reloads', async () => {
    const { ffmpegVideoEngine } = await load();
    const controller = new AbortController();
    const p = ffmpegVideoEngine.run([file('a.mov')], {}, 'mp4', {
      onProgress: () => {},
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(instances[0]?.pendingExec).toBeTruthy());
    controller.abort();
    await expect(p).rejects.toMatchObject({ code: 'CONVERSION_CANCELLED' });
    expect(inst(0).terminate).toHaveBeenCalled();

    const p2 = ffmpegVideoEngine.run([file('b.mov')], {}, 'mp4', { onProgress: () => {} });
    await vi.waitFor(() => expect(instances[1]?.pendingExec).toBeTruthy());
    finishExec(1);
    await expect(p2).resolves.toHaveLength(1);
  });

  it('a failed load is not cached', async () => {
    const { ffmpegAudioEngine } = await load();
    failLoads = 1;
    const run = () => ffmpegAudioEngine.run([file('a.wav')], {}, 'mp3', { onProgress: () => {} });
    const p1 = run();
    await expect(p1).rejects.toMatchObject({ code: 'CONVERSION_FAILED' });

    const p2 = run();
    await vi.waitFor(() => expect(instances[1]?.pendingExec).toBeTruthy());
    finishExec(1);
    await expect(p2).resolves.toHaveLength(1);
  });
});
