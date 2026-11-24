import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { EngineBadge } from "@/components/shared/EngineBadge";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { useServerHealth } from "@/features/server/useServerHealth";
import { ServerWakeBanner } from "@/features/server/ServerWakeBanner";
import { DropZone } from "@/components/tool/DropZone";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/features/server/apiClient";
import type { AppError } from "@/features/server/errorToView";
import { ask } from "./api";
import { extractPages, openPdf } from "./extract";
import { chatPayload, citationParts } from "./prompt";
import { retrieve } from "./retrieve";
import {
  clearIndexes,
  emptyState,
  fingerprint,
  readIndex,
  saveIndex,
  useChat,
} from "./store";
import { DocumentSession } from "./session";
import { PagePreview } from "./PagePreview";

const LIMIT_MB = 25;
const fallback = "I couldn't find that in this document";
const failure = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again.";
const progress = (value: string) => useChat.setState({ progress: value });

export default function ChatPdfPage() {
  const { isWakingUp, serverError, limits } = useServerHealth();
  const unavailable = limits?.serverTools?.["chat-pdf"] === false;
  const { file, status, messages, progress: stage } = useChat();
  const session = useRef<DocumentSession | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const citation = useRef<HTMLButtonElement | null>(null);
  const isSubmitting = useRef(false);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [apiError, setApiError] = useState<AppError | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(
    null,
  );
  const [page, setPage] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  function reset() {
    session.current?.dispose();
    session.current = null;
    isSubmitting.current = false;
    setApiError(null);
    setLastFailedQuestion(null);
    useChat.setState(emptyState);
  }
  useEffect(() => {
    const focus = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "k" &&
        input.current &&
        !input.current.disabled
      ) {
        e.preventDefault();
        input.current.focus();
      }
    };
    window.addEventListener("keydown", focus);
    return () => {
      window.removeEventListener("keydown", focus);
      reset();
    };
  }, []);

  async function select(selected: File) {
    reset();
    setQuestion("");
    setPage(null);
    setError("");
    setApiError(null);
    setLastFailedQuestion(null);
    if (
      selected.size > LIMIT_MB * 1024 * 1024 ||
      !/\.pdf$/i.test(selected.name)
    ) {
      setError("Choose a PDF up to 25 MB.");
      return;
    }
    const current = (session.current = new DocumentSession());
    const signal = current.lifetime.signal;
    useChat.setState({
      file: selected,
      status: "indexing",
      progress: "Reading PDF…",
    });
    try {
      const data = await selected.arrayBuffer();
      const key = await fingerprint(data);
      signal.throwIfAborted();
      const doc = await openPdf(data);
      if (signal.aborted) {
        await doc.loadingTask.destroy();
        return;
      }
      current.pdf = doc;
      let index = await readIndex(key).catch(() => undefined);
      signal.throwIfAborted();
      if (!index) {
        const pages = await extractPages(doc, (n) => {
          if (!signal.aborted) progress(`Reading page ${n} of ${doc.numPages}`);
        });
        const result = await current.run({ pages }, signal, progress);
        if (result instanceof Float32Array) throw new Error("Indexing failed.");
        index = result;
        signal.throwIfAborted();
        await saveIndex(key, index).catch(() => {
          if (!signal.aborted)
            setError(
              "Local storage is unavailable. You can chat for this session.",
            );
        });
      }
      signal.throwIfAborted();
      current.index = index;
      useChat.setState({ status: "ready", progress: "" });
    } catch (e) {
      if (!signal.aborted) {
        reset();
        setError(failure(e));
      }
    }
  }

  async function submit(e?: FormEvent, retryText?: string) {
    e?.preventDefault();
    const current = session.current;
    const text = (retryText ?? question).trim();
    if (
      isSubmitting.current ||
      !current?.index ||
      !text ||
      useChat.getState().status !== "ready" ||
      unavailable
    ) {
      return;
    }
    isSubmitting.current = true;
    const control = (current.answer = new AbortController());
    const prior = useChat.getState().messages;
    const previous = prior.filter((m) => m.role === "user").at(-1);
    const next = [...prior, { role: "user" as const, content: text }];
    setError("");
    setApiError(null);
    setLastFailedQuestion(null);
    if (!retryText) setQuestion("");
    useChat.setState({
      messages: next,
      status: "asking",
      progress: "Finding relevant excerpts…",
    });
    try {
      const query = await current.run(
        { query: text, previous: previous?.content },
        control.signal,
        progress,
      );
      control.signal.throwIfAborted();
      if (!(query instanceof Float32Array))
        throw new Error("Could not search this PDF.");
      const chunks = retrieve(current.index, query, text);
      const pages = chunks.map((chunk) => chunk.page);
      let answer = "";
      const append = (piece: string) => {
        if (control.signal.aborted) return;
        answer += piece;
        useChat.setState({
          messages: [...next, { role: "assistant", content: answer, pages }],
        });
      };
      if (chunks.length) {
        progress("Generating answer with Gemini…");
        await ask(chatPayload(text, chunks, prior), control.signal, append);
      } else append(fallback);
    } catch (e) {
      if (!control.signal.aborted) {
        if (e instanceof ApiClientError) {
          setApiError(e);
        } else {
          setError(failure(e));
        }
        setLastFailedQuestion(text);
        // Revert the unanswered question from message list so the chat history stays clean
        useChat.setState({ messages: prior });
      }
    } finally {
      isSubmitting.current = false;
      if (!current.lifetime.signal.aborted) {
        useChat.setState({
          status: "ready",
          progress: control.signal.aborted ? "Answer stopped." : "",
        });
      }
    }
  }

  async function clear() {
    reset();
    setPage(null);
    setQuestion("");
    setError("");
    setClearing(true);
    try {
      await clearIndexes();
      // Also drop the cached embedding model, in case a broken download is stored.
      if (typeof caches !== "undefined") await caches.delete("transformers-cache").catch(() => false);
      progress("Stored PDF indexes and cached model cleared.");
    } catch {
      setError("Could not clear stored PDF indexes. Try again.");
    } finally {
      setClearing(false);
    }
  }
  return (
    <div className="mx-auto max-w-content space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          to="/tools"
          search={{ category: "documents", q: "" }}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Tools</span>
        </Link>
        <span>/</span>
        <span className="capitalize text-foreground font-medium">
          documents
        </span>
      </div>
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold">Chat with PDF</h1>
          <EngineBadge engine="server" />
        </div>
        <p className="text-sm">
          Only the relevant excerpts are sent to generate answers.
        </p>
        <p className="text-sm text-muted-foreground">
          Your PDF and its search index stay on this device. Google Gemini
          receives your question, matching excerpts, and up to six recent
          messages. The browser loads the embedding model from this site, with
          a fallback to the public Hugging Face model CDN if needed. On the free
          tier, Google may use requests and answers to improve its products.
        </p>
      </header>
      {isWakingUp && <ServerWakeBanner />}
      {serverError && (
        <ErrorAlert
          error={{
            code: "SERVER_OFFLINE",
            message: "The server is currently offline or unreachable.",
          }}
        />
      )}
      {unavailable && (
        <ErrorAlert
          error={{
            code: "PROVIDER_NOT_CONFIGURED",
            message:
              "Chat is unavailable because the server has no Gemini API key configured.",
          }}
        />
      )}
      {!file && !clearing && !unavailable && (
        <DropZone
          acceptedExtensions={["pdf"]}
          maxFileSizeMB={LIMIT_MB}
          multiple={false}
          categoryName="a PDF"
          onFilesAdded={(files) => {
            if (files[0]) void select(files[0]);
          }}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {file && (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{file.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                reset();
                setPage(null);
                setQuestion("");
                setError("");
              }}
            >
              Change PDF
            </Button>
          </div>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={clearing}
          onClick={() => void clear()}
        >
          Clear stored data
        </Button>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {stage}
      </p>
      {apiError && (
        <ErrorAlert
          error={apiError}
          onAction={() => {
            if (lastFailedQuestion) {
              void submit(undefined, lastFailedQuestion);
            }
          }}
        />
      )}
      {error && !apiError && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {(status === "ready" || status === "asking") && (
        <div className={page ? "grid gap-4 lg:grid-cols-2" : ""}>
          <section
            aria-label="PDF conversation"
            className="min-w-0 space-y-4 rounded-card border border-border bg-card p-4"
          >
            {messages.map((m, i) => (
              <article key={i} className="space-y-1">
                <h2 className="text-xs font-semibold text-muted-foreground">
                  {m.role === "user" ? "You" : "Answer"}
                </h2>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {citationParts(m.content, new Set(m.pages)).map((part, j) =>
                    typeof part === "string" ? (
                      part
                    ) : (
                      <button
                        key={j}
                        className="rounded-chip bg-primary/10 px-1.5 text-primary"
                        onClick={(e) => {
                          citation.current = e.currentTarget;
                          setPage(part);
                        }}
                      >
                        [p. {part}]
                      </button>
                    ),
                  )}
                </p>
              </article>
            ))}
            <form onSubmit={submit} className="space-y-2">
              <label
                htmlFor="pdf-question"
                className="block text-sm font-medium"
              >
                Ask about this PDF
              </label>
              <input
                ref={input}
                id="pdf-question"
                maxLength={2000}
                autoComplete="off"
                placeholder={
                  status === "asking"
                    ? "Waiting for Gemini…"
                    : "Type a question…"
                }
                disabled={status === "asking" || unavailable || clearing}
                className="h-10 w-full rounded-btn border border-border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              {lastFailedQuestion && !question && (
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-xs text-muted-foreground">
                    Restore failed question:
                  </span>
                  <button
                    type="button"
                    className="text-xs text-primary underline truncate max-w-sm hover:opacity-80"
                    onClick={() => {
                      setQuestion(lastFailedQuestion);
                      setApiError(null);
                    }}
                  >
                    "{lastFailedQuestion}"
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <kbd className="text-xs text-muted-foreground">Ctrl / ⌘ K</kbd>
                {status === "asking" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => session.current?.answer?.abort()}
                  >
                    Stop
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={
                      !question.trim() ||
                      status !== "ready" ||
                      unavailable ||
                      clearing
                    }
                  >
                    Ask
                  </Button>
                )}
              </div>
            </form>
          </section>
          {page && session.current?.pdf && (
            <PagePreview
              doc={session.current.pdf}
              page={page}
              close={() => {
                setPage(null);
                citation.current?.focus();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
