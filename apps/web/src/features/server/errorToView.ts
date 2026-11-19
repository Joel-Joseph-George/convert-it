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
  severity: 'error' | 'warning';
  actionLabel?: string;
  actionKind?: 'clear' | 'retry' | 'audio-only' | 'try-another';
}

export function errorToView(error: AppError | Error | string): ErrorViewModel {
  const code =
    typeof error === 'string'
      ? error
      : 'code' in error
      ? error.code
      : 'CONVERSION_FAILED';

  const defaultMsg =
    typeof error === 'string'
      ? ''
      : 'message' in error && error.message
      ? error.message
      : '';

  switch (code) {
    case 'ERR_INVALID_URL':
    case 'INVALID_URL':
      return {
        title: "That doesn't look like a YouTube link",
        message: 'Check the URL syntax and try submitting again.',
        severity: 'error',
        actionLabel: 'Clear',
        actionKind: 'clear',
      };

    case 'ERR_MEDIA_RESTRICTED':
    case 'VIDEO_UNAVAILABLE':
      return {
        title: "This video can't be downloaded",
        message: 'It may be private, age-restricted, or removed.',
        severity: 'error',
        actionLabel: 'Try another link',
        actionKind: 'try-another',
      };

    case 'AGE_RESTRICTED':
      return {
        title: 'This video is age-restricted',
        message: 'Sign-in is required to access age-restricted media.',
        severity: 'error',
        actionLabel: 'Try another link',
        actionKind: 'try-another',
      };

    case 'LIMIT_EXCEEDED':
    case 'VIDEO_TOO_LONG':
      return {
        title: 'This video is too long',
        message: defaultMsg || 'Downloads are limited to 60 minutes on this server.',
        severity: 'warning',
        actionLabel: 'Choose audio only',
        actionKind: 'audio-only',
      };

    case 'FILE_TOO_LARGE':
      return {
        title: 'File is too large',
        message: defaultMsg || 'The uploaded file exceeds the maximum size limit for this tool.',
        severity: 'warning',
        actionLabel: 'Clear',
        actionKind: 'clear',
      };

    case 'UNSUPPORTED_FILE_TYPE':
      return {
        title: 'Unsupported file type',
        message: defaultMsg || 'The file format is not supported by this converter.',
        severity: 'error',
        actionLabel: 'Clear',
        actionKind: 'clear',
      };

    case 'ERR_UPSTREAM_BLOCKED':
    case 'UPSTREAM_BLOCKED':
      return {
        title: "The server couldn't reach YouTube right now",
        message: 'Try again in a few minutes.',
        severity: 'error',
        actionLabel: 'Retry',
        actionKind: 'retry',
      };

    case 'ERR_HOST_UNREACHABLE':
    case 'SERVER_OFFLINE':
      return {
        title: 'The server is not responding',
        message: 'It may be restarting or starting up from cold boot.',
        severity: 'error',
        actionLabel: 'Retry',
        actionKind: 'retry',
      };

    case 'TOOL_NOT_FOUND':
    case 'TOOL_DISABLED':
      return {
        title: 'Unavailable on this server',
        message: 'This tool is not enabled or supported on the current server.',
        severity: 'warning',
        actionLabel: 'Browse all tools',
        actionKind: 'try-another',
      };

    case 'CONVERSION_TIMEOUT':
      return {
        title: 'Conversion timed out',
        message: 'The file took too long to process and was halted.',
        severity: 'error',
        actionLabel: 'Retry',
        actionKind: 'retry',
      };

    case 'CONVERSION_FAILED':
    default:
      return {
        title: 'Conversion failed',
        message: defaultMsg || 'An error occurred during file conversion. Please retry.',
        severity: 'error',
        actionLabel: 'Retry',
        actionKind: 'retry',
      };
  }
}
