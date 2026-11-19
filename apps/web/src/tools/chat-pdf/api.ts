import { API_BASE_URL, ApiClientError, getHeaders } from '@/features/server/apiClient';
import type { chatPayload } from './prompt';

const interrupted = () => new ApiClientError({
  code: 'STREAM_INTERRUPTED', message: 'The answer stream was interrupted. Try asking again.', retryable: true,
});

export async function readAnswer(stream: ReadableStream<Uint8Array>, token: (text: string) => void) {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let pending = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw interrupted();
      pending += value;
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(pending))) {
        const frame = pending.slice(0, separator.index).split(/\r?\n/);
        pending = pending.slice(separator.index + separator[0].length);
        const event = frame.find(l => l.startsWith('event:'))?.slice(6).trim();
        if (!event) continue;
        const json = frame.filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
        let data;
        try { data = JSON.parse(json); } catch { throw interrupted(); }
        if (event === 'done') return;
        if (event === 'error' && data?.error) throw new ApiClientError(data.error);
        if (event !== 'token' || typeof data?.token !== 'string') throw interrupted();
        token(data.token);
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function ask(payload: ReturnType<typeof chatPayload>, signal: AbortSignal, token: (s: string) => void) {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST', headers: { ...getHeaders('application/json'), Accept: 'text/event-stream' },
    body: JSON.stringify(payload), signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiClientError(body?.error ?? { code: 'UPSTREAM_ERROR', message: 'Could not start the answer.' });
  }
  if (!res.body) throw interrupted();
  await readAnswer(res.body, token);
}
