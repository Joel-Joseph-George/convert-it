import * as React from 'react';
import { Link as LinkIcon, ArrowRight, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorAlert } from '@/components/shared/ErrorAlert';
import { cn } from '@/lib/utils';
import { isYouTubeUrl } from '@/features/youtube/url';

export interface UrlInputProps {
  /** Controlled value; when omitted the input manages its own state. */
  value?: string;
  onValueChange?: (url: string) => void;
  onFetch?: (url: string) => void;
  isLoading?: boolean;
  className?: string;
}

export const UrlInput: React.FC<UrlInputProps> = ({
  value,
  onValueChange,
  onFetch,
  isLoading = false,
  className,
}) => {
  const [localUrl, setLocalUrl] = React.useState('');
  const url = value ?? localUrl;
  const setUrl = (next: string): void => {
    setLocalUrl(next);
    onValueChange?.(next);
  };
  const [error, setError] = React.useState<string | null>(null);

  const handlePaste = async (): Promise<void> => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text.trim());
          setError(null);
        }
      }
    } catch {
      // Silently handle clipboard permission denial as instructed in spec Section 6.5
    }
  };

  const handleSubmit = (e?: React.FormEvent): void => {
    if (e) e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    if (!isYouTubeUrl(trimmed)) {
      setError('ERR_INVALID_URL');
      return;
    }

    setError(null);
    onFetch?.(trimmed);
  };

  const handleClear = (): void => {
    setUrl('');
    setError(null);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex flex-col sm:flex-row items-center gap-2 rounded-card border border-border bg-card p-1.5 shadow-none transition-colors focus-within:border-primary/50">
          <div className="flex flex-1 items-center gap-2 w-full px-3 py-1">
            <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Paste a YouTube link here"
              className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
            {url && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear input"
                className="text-muted-foreground hover:text-foreground p-1 rounded-full"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePaste}
              className="text-xs font-medium text-muted-foreground"
            >
              Paste
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="w-full sm:w-auto text-xs font-medium gap-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Fetching...</span>
                </>
              ) : (
                <>
                  <span>Fetch Media</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Supports youtube.com and youtu.be links
          </span>
          <span>For personal use only.</span>
        </div>
      </form>

      {error && (
        <ErrorAlert
          error={error}
          onAction={() => handleClear()}
        />
      )}
    </div>
  );
};
