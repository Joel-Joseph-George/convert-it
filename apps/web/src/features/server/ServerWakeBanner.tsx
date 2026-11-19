import React from 'react';
import { Loader2 } from 'lucide-react';

interface ServerWakeBannerProps {
  message?: string;
}

export const ServerWakeBanner: React.FC<ServerWakeBannerProps> = ({
  message = 'Waking up the server, this can take up to a minute the first time...',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full mb-6 p-3 px-4 rounded-card bg-surface border border-accent/30 text-text flex items-center gap-3 text-sm animate-pulse"
    >
      <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
      <span className="font-sans text-xs sm:text-sm font-medium">{message}</span>
    </div>
  );
};
