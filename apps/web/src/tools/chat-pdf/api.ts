import {
  API_BASE_URL,
  ApiClientError,
  getHeaders,
  promptOnAuthError,
} from '@/features/server/apiClient';
import { readSseEvents } from '@/features/server/sse';
import type { chatPayload } from './prompt';

const interrupted = () =>
  new ApiClientError({
    code: 'STREAM_INTERRUPTED',
    message: 'The answer stream was interrupted. Try asking again.',
    retryable: true,
  });

export async function readAnswer(
  stream: ReadableStream<Uint8Array>,
  token: (text: string) => void,
) {
  for await (const { event, data: raw } of readSseEvents(stream)) {
    if (event === 'message') continue;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw interrupted();
    }
    if (event === 'done') return;
    if (event === 'error' && data?.error) throw new ApiClientError(data.error);
    if (event !== 'token' || typeof data?.token !== 'string') throw interrupted();
    token(data.token);
  }
  throw interrupted();
}

export async function ask(
  payload: ReturnType<typeof chatPayload>,
  signal: AbortSignal,
  token: (s: string) => void,
) {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { ...getHeaders('application/json'), Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const error = body?.error ?? { code: 'UPSTREAM_ERROR', message: 'Could not start the answer.' };
    promptOnAuthError(error);
    throw new ApiClientError(error);
  }
  if (!res.body) throw interrupted();
  await readAnswer(res.body, token);
}
