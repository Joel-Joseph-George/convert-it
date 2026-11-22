import * as React from 'react';
import { Link } from '@tanstack/react-router';
import {
  Zap,
  ArrowRight,
  FileText,
  FileSpreadsheet,
  Music,
  Video,
  Image as ImageIcon,
  Minimize2,
  File,
} from 'lucide-react';
import { getPopularTools } from '@/features/registry/tools';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PopularToolsStripProps {
  className?: string;
}

function getPopularToolIcon(id: string): React.ComponentType<{ className?: string }> {
  switch (id) {
    case 'merge-pdf':
    case 'pdf-to-word':
      return FileText;
    case 'image-compress':
      return Minimize2;
    case 'audio-convert':
      return Music;
    case 'excel-to-csv':
      return FileSpreadsheet;
    case 'video-to-gif':
      return Video;
    case 'heic-to-jpg':
    case 'images-to-pdf':
      return ImageIcon;
    default:
      return File;
  }
}

export const PopularToolsStrip: React.FC<PopularToolsStripProps> = ({
  className,
}) => {
  const popularTools = getPopularTools();

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span>Popular tools</span>
        </div>
        <span className="text-muted-foreground">Client-side • Instant</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {popularTools.map((tool) => {
          const Icon = getPopularToolIcon(tool.id);
          return (
            <Link
              key={tool.id}
              to="/tools/$toolId"
              params={{ toolId: tool.id }}
              className="flex items-center gap-2.5 rounded-card border border-border bg-card p-3 text-left transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-muted hover:shadow-sm motion-safe:hover:-translate-y-0.5"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-btn bg-muted text-muted-foreground">
                <Icon className="h-3.5 w-3.5 stroke-[1.75]" />
              </div>
              <span className="text-xs font-medium text-foreground truncate">
                {tool.name}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex justify-center pt-2">
        <Link to="/tools">
          <Button variant="secondary" size="sm" className="text-xs gap-1.5">
            <span>Browse all tools</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
};
