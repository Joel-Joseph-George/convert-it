export interface SseEvent {
  /** The `event:` field, or "message" when the frame has none. */
  event: string;
  /** All `data:` lines of the frame joined with "\n". */
  data: string;
}

/**
 * Parse a text/event-stream body into events. Comment-only frames (heartbeats)
 * and frames without data are skipped. Ends when the stream ends; breaking out
 * of the loop cancels the stream.
 */
export async function* readSseEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SseEvent, void, undefined> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      pending += decoder.decode(value, { stream: true });
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(pending))) {
        const lines = pending.slice(0, separator.index).split(/\r?\n/);
        pending = pending.slice(separator.index + separator[0].length);
        let event = "message";
        const data: string[] = [];
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:"))
            data.push(line.slice(5).trimStart());
        }
        if (data.length > 0) yield { event, data: data.join("\n") };
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
