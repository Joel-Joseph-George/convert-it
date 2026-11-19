import React from 'react';

export const YouTubeSkeleton: React.FC = () => {
  return (
    <div
      role="status"
      aria-label="Loading video details"
      className="w-full bg-surface border border-border rounded-card p-5 sm:p-6 mb-8 shadow-sm animate-pulse"
    >
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="w-full sm:w-48 aspect-video rounded-lg bg-border/60 shrink-0" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-5 bg-border/60 rounded w-3/4" />
          <div className="h-4 bg-border/40 rounded w-1/2" />
          <div className="h-3 bg-border/30 rounded w-1/4" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="h-8 bg-border/40 rounded-chip w-44" />
        <div className="h-9 bg-border/40 rounded w-32" />
      </div>
    </div>
  );
};
