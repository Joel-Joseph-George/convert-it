import { describe, expect, it } from 'vitest';
import { chunkPages } from '@/tools/chat-pdf/chunker';
import { retrieve, retrievalQuery } from '@/tools/chat-pdf/retrieve';
import { citationParts, chatPayload } from '@/tools/chat-pdf/prompt';
import { readAnswer } from '@/tools/chat-pdf/api';

const tokens = (s: string) => s.trim().split(/\s+/).length + 2;

describe('PDF excerpts', () => {
  it('preserves complete sentences, page identity and bounded overlap', () => {
    const sentences = Array.from(
      { length: 24 },
      (_, i) => `Sentence ${i} ${'contains several useful words '.repeat(2)}.`,
    );
    const chunks = chunkPages(
      [
        { page: 2, text: sentences.join(' ') },
        { page: 4, text: 'Another page.' },
      ],
      tokens,
    );
    expect(chunks.length).toBeGreaterThan(2);
    for (const s of sentences) expect(chunks.some((c) => c.text.includes(s))).toBe(true);
    const first = chunks[0]?.text ?? '';
    const overlap = sentences
      .filter((s) => first.includes(s) && chunks[1]?.text.includes(s))
      .join(' ');
    expect(overlap.length).toBeGreaterThan(0);
    expect(overlap.length).toBeLessThanOrEqual(150);
    expect(first.endsWith(overlap) && chunks[1]?.text.startsWith(overlap)).toBe(true);
    expect(chunks.at(-1)).toMatchObject({ page: 4, text: 'Another page.' });
    expect(chunks.every((c) => c.text.length <= 900 && tokens(c.text) <= 256)).toBe(true);
  });
  it('prefers paragraphs and checks the actual token budget, including special tokens', () => {
    const p = 'First sentence. '.repeat(28).trim();
    const q = 'Second sentence. '.repeat(32).trim();
    const chunks = chunkPages([{ page: 1, text: p + '\n\n' + q }], tokens);
    expect(chunks[0]?.text).toBe(p);
    expect(chunkPages([], tokens)).toEqual([]);
    expect(chunkPages([{ page: 1, text: '   ' }], tokens)).toEqual([]);
    expect(() => chunkPages([{ page: 3, text: 'Dense sentence.' }], () => 257)).toThrow('page 3');
    const dense = chunkPages(
      [{ page: 1, text: 'One. Two. Three.' }],
      (s) => s.split('. ').length * 100,
    );
    expect(dense.every((c) => !c.text.includes('One. Two. Three.'))).toBe(true);
  });
  it('ranks normalized vectors, caps results and drops weak matches', () => {
    const scores = [-1, 0.24, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    const index = {
      chunks: scores.map((_, i) => ({ id: String(i), page: i + 1, text: 'excerpt' })),
      vectors: scores.map((s) => Float32Array.of(s, Math.sqrt(1 - s * s))),
    };
    expect(retrieve(index, Float32Array.of(1, 0)).map((c) => c.page)).toEqual([8, 7, 6, 5, 4]);
    expect(retrieve(index, Float32Array.of(0, -1))).toEqual([]);
    const encode = (text: string) => Array.from(text, (char) => char.charCodeAt(0));
    const decode = (ids: number[]) => String.fromCharCode(...ids);
    expect(retrievalQuery('And when?', 'Who opened the library?', encode, decode)).toContain(
      'Who opened the library?',
    );
    const longQuery = retrievalQuery('a'.repeat(300), 'b'.repeat(300), encode, decode);
    expect(longQuery).toEqual('a'.repeat(190) + 'b'.repeat(64));
    expect(
      chatPayload('Q', [index.chunks[0] ?? { page: 1, text: '' }], []).chunks[0],
    ).not.toHaveProperty('id');
  });
  it('makes chips only for retrieved pages', () => {
    expect(citationParts('See [p. 4] and [p. 99].', new Set([4]))).toEqual([
      'See ',
      4,
      ' and ',
      '[p. 99]',
      '.',
    ]);
  });
});

function bytes(text: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of new TextEncoder().encode(text)) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
}
describe('answer SSE', () => {
  it('handles fragmented UTF-8, CRLF, comments and a terminal done', async () => {
    const parts: string[] = [];
    await readAnswer(
      bytes(
        ': ping\r\n\r\nevent: token\r\ndata: {"token":"café"}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n',
      ),
      (s) => parts.push(s),
    );
    expect(parts).toEqual(['café']);
  });
  it('preserves structured errors and detects missing terminal frames', async () => {
    await expect(
      readAnswer(
        bytes(
          'event: error\ndata: {"error":{"code":"BUSY","message":"Wait","retryAfterSec":3}}\n\n',
        ),
        () => {},
      ),
    ).rejects.toMatchObject({ code: 'BUSY', retryAfterSec: 3 });
    await expect(
      readAnswer(bytes('event: token\ndata: {"token":"partial"}\n\n'), () => {}),
    ).rejects.toMatchObject({ code: 'STREAM_INTERRUPTED' });
  });
});
