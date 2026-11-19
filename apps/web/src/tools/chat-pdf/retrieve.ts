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

export function retrieve(index: Index, query: Float32Array) {
  return index.chunks
    .map((chunk, position) => {
      const vector = index.vectors[position];
      let score = 0;
      if (!vector || vector.length !== query.length) throw new Error('Invalid cached embedding.');
      for (let i = 0; i < vector.length; i++) score += (vector[i] ?? 0) * (query[i] ?? 0);
      return { chunk, score };
    })
    .filter((match) => match.score >= MIN_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map((match) => match.chunk);
}
