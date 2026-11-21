import type { Message } from './store';
import type { PageText } from './chunker';

export function chatPayload(question: string, chunks: PageText[], history: Message[]) {
  return {
    question,
    chunks: chunks.map(({ page, text }) => ({ page, text })),
    history: history
      .filter((m) => m.content)
      .slice(-6)
      .map(({ role, content }) => ({ role, content: content.slice(0, 4000) })),
  };
}

export function citationParts(text: string, pages: ReadonlySet<number>): (string | number)[] {
  return text
    .split(/(\[p\. \d+\])/g)
    .filter(Boolean)
    .map((part) => {
      const match = /^\[p\. (\d+)\]$/.exec(part);
      const page = Number(match?.[1]);
      return match && pages.has(page) ? page : part;
    });
}
