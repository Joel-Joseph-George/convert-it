import * as React from 'react';
import { Link } from '@tanstack/react-router';
import {
  FileText,
  FileSpreadsheet,
  Music,
  Video,
  Image as ImageIcon,
  Minimize2,
  FileCode,
  File,
} from 'lucide-react';
import { ToolDefinition } from '@/features/registry/types';
import { EngineBadge } from '@/components/shared/EngineBadge';
import { cn } from '@/lib/utils';

export interface ToolCardProps {
  tool: ToolDefinition;
  className?: string;
}

function getToolIcon(tool: ToolDefinition): React.ComponentType<{ className?: string }> {
  switch (tool.category) {
    case 'pdf':
      return FileText;
    case 'image':
      return tool.id.includes('compress') ? Minimize2 : ImageIcon;
    case 'audio':
      return Music;
    case 'video':
      return Video;
    case 'data':
      return FileSpreadsheet;
    case 'text':
      return FileCode;
    case 'documents':
      return FileText;
    default:
      return File;
  }
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool, className }) => {
  const Icon = getToolIcon(tool);

  const formatList = tool.outputs.map((o) => o.label).join(' • ');

  return (
    <Link
      to="/tools/$toolId"
      params={{ toolId: tool.id }}
      className={cn(
        'group flex flex-col justify-between rounded-card border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex h-8 w-8 items-center justify-center rounded-btn bg-primary/10 text-primary transition-transform group-hover:scale-105">
            <Icon className="h-4 w-4 stroke-[1.75]" />
          </div>
          <EngineBadge engine={tool.engine.kind} badge={tool.badge} />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {tool.name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {tool.description}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-border text-[10px] font-mono text-muted-foreground">
        <span className="rounded-chip bg-muted px-1.5 py-0.5">
          {formatList}
        </span>
        {tool.engine.kind === 'browser' && (
          <span className="rounded-chip bg-muted px-1.5 py-0.5">
            WASM Core
          </span>
        )}
      </div>
    </Link>
  );
};
