export interface AppError {
  code: string;
  message?: string;
  retryable?: boolean;
  retryAfterSec?: number | null;
  details?: Record<string, unknown>;
}

export interface ErrorViewModel {
  title: string;
  message: string;
  severity: "error" | "warning";
  actionLabel?: string;
  actionKind?: "clear" | "retry" | "audio-only" | "try-another" | "options" | "access-code";
}

export function errorToView(error: AppError | Error | string): ErrorViewModel {
  const code =
    typeof error === "string"
      ? error
      : "code" in error
        ? error.code
        : "CONVERSION_FAILED";

  const defaultMsg =
    typeof error === "string"
      ? ""
      : "message" in error && error.message
        ? error.message
        : "";

  switch (code) {
    case "ERR_INVALID_URL":
    case "INVALID_URL":
      return {
        title: "That doesn't look like a YouTube link",
        message: "Check the URL syntax and try submitting again.",
        severity: "error",
        actionLabel: "Clear",
        actionKind: "clear",
      };

    case "ERR_MEDIA_RESTRICTED":
    case "VIDEO_UNAVAILABLE":
      return {
        title: "This video can't be downloaded",
        message: "It may be private, age-restricted, or removed.",
        severity: "error",
        actionLabel: "Try another link",
        actionKind: "try-another",
      };

    case "AGE_RESTRICTED":
      return {
        title: "This video is age-restricted",
        message: "Sign-in is required to access age-restricted media.",
        severity: "error",
        actionLabel: "Try another link",
        actionKind: "try-another",
      };

    case "LIMIT_EXCEEDED":
    case "VIDEO_TOO_LONG":
      return {
        title: "This video is too long",
        message:
          defaultMsg || "Downloads are limited to 60 minutes on this server.",
        severity: "warning",
        actionLabel: "Choose audio only",
        actionKind: "audio-only",
      };

    case "FILE_TOO_LARGE":
      return {
        title: "File is too large",
        message:
          defaultMsg ||
          "The uploaded file exceeds the maximum size limit for this tool.",
        severity: "warning",
        actionLabel: "Clear",
        actionKind: "clear",
      };

    case "UNSUPPORTED_FILE_TYPE":
      return {
        title: "Unsupported file type",
        message:
          defaultMsg || "The file format is not supported by this converter.",
        severity: "error",
        actionLabel: "Clear",
        actionKind: "clear",
      };

    case "NO_TABLES_FOUND":
      return {
        title: "No tables found",
        message:
          defaultMsg ||
          "No tabular data was detected in this document. Scanned PDFs may need OCR.",
        severity: "warning",
        actionLabel: "Try another file",
        actionKind: "clear",
      };

    case "ERR_UPSTREAM_BLOCKED":
    case "UPSTREAM_BLOCKED":
      return {
        title: "The server couldn't reach YouTube right now",
        message: "Try again in a few minutes.",
        severity: "error",
        actionLabel: "Retry",
        actionKind: "retry",
      };

    case "PROVIDER_NOT_CONFIGURED":
      return {
        title: "Chat Unavailable",
        message:
          "The server has no Gemini API key configured in its environment.",
        severity: "warning",
        actionLabel: "Browse all tools",
        actionKind: "try-another",
      };

    case "PROVIDER_AUTH_ERROR":
      return {
        title: "Invalid Gemini API Key",
        message:
          "The server's Gemini API key was rejected by Google. Verify GEMINI_API_KEY in server settings.",
        severity: "error",
      };

    case "PROVIDER_MODEL_NOT_FOUND":
      return {
        title: "Gemini Model Not Found",
        message:
          "The server's GEMINI_MODEL setting names a model Google doesn't offer. Update it in server settings.",
        severity: "error",
      };

    case "PROVIDER_UNAVAILABLE":
      return {
        title: "Gemini Unavailable Here",
        message: "Google doesn't offer Gemini in the server's region.",
        severity: "error",
      };

    case "PROVIDER_BAD_REQUEST":
      return {
        title: "Gemini Rejected the Request",
        message: "Check the server log for Google's message, then the key and project in Google AI Studio.",
        severity: "error",
        actionLabel: "Retry",
        actionKind: "retry",
      };

    case "PROVIDER_QUOTA_EXHAUSTED":
      return {
        title: "Gemini Quota Exhausted",
        message:
          "Your Gemini API key has exceeded its daily token or request limit. Check Google AI Studio or use another key.",
        severity: "warning",
        actionLabel: "Try again later",
        actionKind: "retry",
      };

    case "PROVIDER_RATE_LIMITED":
      return {
        title: "Rate Limit Reached",
        message:
          defaultMsg ||
          "AI service rate limit reached. Please wait a moment before asking again.",
        severity: "warning",
        actionLabel: "Retry",
        actionKind: "retry",
      };

    case "PROVIDER_TIMEOUT":
      return {
        title: "Gemini Timed Out",
        message:
          "The response took too long to generate. Try asking a more specific question.",
        severity: "error",
        actionLabel: "Retry",
        actionKind: "retry",
      };

    case "ERR_HOST_UNREACHABLE":
    case "SERVER_OFFLINE":
      return {
        title: "The server is not responding",
        message: "It may be restarting or starting up from cold boot.",
        severity: "error",
        actionLabel: "Retry",
        actionKind: "retry",
      };

    case "TOOL_NOT_FOUND":
    case "TOOL_DISABLED":
      return {
        title: "Unavailable on this server",
        message: "This tool is not enabled or supported on the current server.",
        severity: "warning",
        actionLabel: "Browse all tools",
        actionKind: "try-another",
      };

    case "CONVERSION_TIMEOUT":
      return {
        title: "Conversion timed out",
        message: "The file took too long to process and was halted.",
        severity: "error",
        actionLabel: "Retry",
        actionKind: "retry",
      };

    case "UNSUPPORTED_URL":
      return {
        title: "That link isn't supported",
        message: defaultMsg || "Paste a link to a single YouTube video.",
        severity: "error",
        actionLabel: "Clear",
        actionKind: "clear",
      };

    case "INVALID_OPTIONS":
      return {
        title: "Check your options",
        message: defaultMsg || "One of the selected options is invalid.",
        severity: "warning",
        actionLabel: "Change options",
        actionKind: "options",
      };

    case "FORMAT_UNAVAILABLE":
      return {
        title: "That quality or format isn't available",
        message: defaultMsg || "Pick a different quality or format and try again.",
        severity: "warning",
        actionLabel: "Change options",
        actionKind: "options",
      };

    case "NETWORK_ERROR":
      return {
        title: "Couldn't reach the server",
        message: defaultMsg || "It may be waking up from sleep. Try again in a moment.",
        severity: "error",
        actionLabel: "Retry",
        actionKind: "retry",
      };

    case "JOB_NOT_FOUND":
    case "JOB_EXPIRED":
      return {
        title: "This job is no longer available",
        message: defaultMsg || "The server may have restarted. Please try again.",
        severity: "warning",
        actionLabel: "Retry",
        actionKind: "retry",
      };

    case "RATE_LIMITED":
    case "QUEUE_FULL":
    case "SERVER_BUSY":
      return {
        title: "The server is busy",
        message: defaultMsg || "Please wait a moment and try again.",
        severity: "warning",
        actionLabel: "Retry",
        actionKind: "retry",
      };

    case "AUTH_REQUIRED":
      return {
        title: "Access code required",
        message: defaultMsg || "This server requires an access code for server tools.",
        severity: "error",
        actionLabel: "Enter code",
        actionKind: "access-code",
      };

    case "CONVERSION_FAILED":
    default:
      return {
        title: "Conversion failed",
        message:
          defaultMsg ||
          "An error occurred during file conversion. Please retry.",
        severity: "error",
        actionLabel: "Retry",
        actionKind: "retry",
      };
  }
}
