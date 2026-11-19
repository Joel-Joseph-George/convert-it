import type { Index } from './embed.worker';

export const MIN_SIMILARITY = 0.25;
export const TOP_K = 5;

export function retrievalQuery(question: string, previous?: string) {
  return previous ? `${question}\n${previous}` : question;
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
