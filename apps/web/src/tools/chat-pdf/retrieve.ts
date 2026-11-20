import type { Index } from './embed.worker';
import { MAX_TOKENS } from './chunker';

export const MIN_SIMILARITY = 0.25;
export const TOP_K = 5;

export function retrievalQuery(
  question: string,
  previous: string | undefined,
  encode: (text: string) => number[],
  decode: (ids: number[]) => string,
) {
  const budget = MAX_TOKENS - 2; // MiniLM adds [CLS] and [SEP].
  const current = encode(question);
  const prior = previous ? encode(previous) : [];
  if (current.length + prior.length <= budget)
    return previous ? `${question}\n${previous}` : question;
  const historySize = Math.min(prior.length, Math.max(64, budget - current.length));
  return decode([...current.slice(0, budget - historySize), ...prior.slice(0, historySize)]);
}

const overviewIntent =
  /\b(?:summari[sz]e|summary|overview|key (?:points|findings|takeaways)|main (?:ideas?|topics?|points?)|tl;?dr)\b/i;
const documentSubject =
  /\b(?:this|the|entire|whole) (?:pdf|document|file|report|paper|article|handbook)\b/i;
const aboutDocument =
  /\bwhat(?:'s| is) (?:this|it|(?:this|the) (?:pdf|document|file|report|paper|article|handbook)) (?:all )?about\b/i;
const commonWords = new Set(
  'about according and are can could did document does explain file for from give how into list pdf please say tell that the their them there these they this what when where which who why with would you'.split(
    ' ',
  ),
);
const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

export function retrieve(index: Index, query: Float32Array, question: string) {
  const terms = [
    ...new Set(words(question).filter((word) => word.length >= 3 && !commonWords.has(word))),
  ];
  const ranked = index.chunks
    .map((chunk, position) => {
      const vector = index.vectors[position];
      let score = 0;
      if (!vector || vector.length !== query.length) throw new Error('Invalid cached embedding.');
      for (let i = 0; i < vector.length; i++) score += (vector[i] ?? 0) * (query[i] ?? 0);
      // Exact names and identifiers can be diluted in the embedding of a long excerpt.
      if (terms.length) {
        const excerpt = new Set(words(chunk.text));
        const coverage = terms.filter((term) => excerpt.has(term)).length / terms.length;
        score += MIN_SIMILARITY * coverage;
      }
      return { chunk, score };
    })
    .sort((a, b) => b.score - a.score);

  // A page reference is evidence of relevance even if the number isn't in the text.
  const pages = [...question.matchAll(/\b(?:page\s+|p\.\s*)(\d+)\b/gi)].map((m) => Number(m[1]));
  if (pages.length) {
    return ranked
      .filter(({ chunk }) => pages.includes(chunk.page))
      .slice(0, TOP_K)
      .map(({ chunk }) => chunk);
  }
  const matches = ranked.filter((match) => match.score >= MIN_SIMILARITY);
  const overview =
    overviewIntent.test(question) && !/\b(?:about|regarding|related to)\s+\S/i.test(question);
  const documentQuestion = documentSubject.test(question);
  if (
    aboutDocument.test(question) ||
    (overview && documentQuestion) ||
    (!matches.length && (overview || documentQuestion))
  ) {
    // Sample in reading order so an overview can draw on the beginning, middle and end.
    const chunks = index.chunks;
    if (chunks.length <= TOP_K) return chunks;
    const positions = new Set(
      Array.from({ length: TOP_K }, (_, j) => Math.round((j * (chunks.length - 1)) / (TOP_K - 1))),
    );
    return chunks.filter((_, i) => positions.has(i));
  }
  return matches.slice(0, TOP_K).map((match) => match.chunk);
}
