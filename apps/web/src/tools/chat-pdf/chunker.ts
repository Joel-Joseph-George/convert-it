export interface PageText {
  page: number;
  text: string;
}
export interface Chunk extends PageText {
  id: string;
}

const TARGET = 900;
const OVERLAP = 150;
export const MAX_TOKENS = 256;

// countTokens includes the tokenizer's special tokens.
export function chunkPages(pages: PageText[], countTokens: (text: string) => number): Chunk[] {
  const chunks: Chunk[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
  for (const { page, text } of pages) {
    const sentences: string[] = [];
    const fits = (value: string) => value.length <= TARGET && countTokens(value) <= MAX_TOKENS;
    function flush(next = '') {
      if (!sentences.length) return;
      chunks.push({ page, text: sentences.join(' '), id: `${page}-${chunks.length}` });
      while (
        sentences.length &&
        (sentences.join(' ').length > OVERLAP || !fits([...sentences, next].join(' ')))
      )
        sentences.shift();
    }
    for (const paragraph of text.split(/\n\s*\n/)) {
      const normalized = paragraph.replace(/\s+/g, ' ').trim();
      if (!normalized) continue;
      if (sentences.length && !fits([...sentences, normalized].join(' '))) flush(normalized);
      for (const { segment } of segmenter.segment(normalized)) {
        const sentence = segment.trim();
        let remaining = sentence;
        while (remaining) {
          let part = remaining;
          if (!fits(part)) {
            let end = Math.min(part.length, TARGET);
            while (end > 0 && !fits(part.slice(0, end))) end--;
            if (!end) throw new Error(`Unable to split text on page ${page} within the token limit.`);
            const boundary = part.slice(0, end + 1).search(/\s+\S*$/);
            if (boundary > 0) end = boundary;
            part = part.slice(0, end).trim();
          }
          if (sentences.length && !fits([...sentences, part].join(' '))) flush(part);
          sentences.push(part);
          remaining = remaining.slice(part.length).trimStart();
        }
      }
    }
    flush();
  }
  return chunks;
}
