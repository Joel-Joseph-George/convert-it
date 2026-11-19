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
        if (sentence.length > 1500 || countTokens(sentence) > MAX_TOKENS) {
          throw new Error(
            `A sentence on page ${page} exceeds the excerpt limit. Try a PDF with shorter sentences.`,
          );
        }
        if (sentences.length && !fits([...sentences, sentence].join(' '))) flush(sentence);
        sentences.push(sentence);
      }
    }
    flush();
  }
  return chunks;
}
