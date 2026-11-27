import { describe, it, expect, beforeEach } from "vitest";
import { readSseEvents } from "@/features/server/sse";
import {
  apiClient,
  getHeaders,
  promptOnAuthError,
} from "@/features/server/apiClient";
import { useSettingsStore } from "@/features/settings/settingsStore";
import {
  extractUrl,
  filesForTool,
  isSharedYouTubeLink,
  pickToolForFiles,
} from "@/features/share/shareInbox";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("readSseEvents", () => {
  it("parses frames split across chunks and skips heartbeats", async () => {
    const events = [];
    for await (const e of readSseEvents(
      streamOf(
        ": ping\n\nevent: prog",
        'ress\ndata: {"progress":5}\n\r\n',
        'data: {"a":1}\n\n',
      ),
    )) {
      events.push(e);
    }
    expect(events).toEqual([
      { event: "progress", data: '{"progress":5}' },
      { event: "message", data: '{"a":1}' },
    ]);
  });
});

describe("access code", () => {
  beforeEach(() => {
    useSettingsStore.setState({ accessCode: "", accessPromptOpen: false });
  });

  it("opens the prompt only for AUTH_REQUIRED", () => {
    promptOnAuthError({ code: "RATE_LIMITED" });
    expect(useSettingsStore.getState().accessPromptOpen).toBe(false);
    promptOnAuthError({ code: "AUTH_REQUIRED" });
    expect(useSettingsStore.getState().accessPromptOpen).toBe(true);
  });

  it("sends the stored code as a header", () => {
    expect(getHeaders()["X-Access-Code"]).toBeUndefined();
    useSettingsStore.getState().setAccessCode("abc");
    expect(getHeaders("application/json")).toMatchObject({
      "X-Access-Code": "abc",
      "Content-Type": "application/json",
    });
  });

  it("puts the download token in the link", () => {
    expect(apiClient.getDownloadUrl("job1")).toMatch(
      /\/api\/jobs\/job1\/download$/,
    );
    expect(apiClient.getDownloadUrl("job1", "123.ab")).toMatch(
      /download\?token=123\.ab$/,
    );
  });
});

describe("share target routing", () => {
  const file = (name: string) => new File(["x"], name);

  it("finds a YouTube link inside shared text", () => {
    expect(extractUrl("Watch this https://youtu.be/abc123 now")).toBe(
      "https://youtu.be/abc123",
    );
    expect(isSharedYouTubeLink("Look https://youtu.be/abc123")).toBe(
      "https://youtu.be/abc123",
    );
    expect(isSharedYouTubeLink("https://example.com/video")).toBeNull();
  });

  it("picks a tool from the first file and keeps only files it accepts", () => {
    expect(pickToolForFiles([file("photo.JPG")])?.id).toBe("image-editor");
    expect(pickToolForFiles([file("song.flac")])?.id).toBe("audio-convert");
    expect(pickToolForFiles([file("archive.zip")])).toBeNull();
    expect(pickToolForFiles([])).toBeNull();

    const audio = pickToolForFiles([file("a.mp3")]);
    expect(
      audio &&
        filesForTool(audio, [file("a.mp3"), file("b.txt"), file("c.wav")]).map(
          (f) => f.name,
        ),
    ).toEqual(["a.mp3", "c.wav"]);
  });
});
