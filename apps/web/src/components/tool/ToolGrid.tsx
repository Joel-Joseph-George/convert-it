import * as React from 'react';
import { ToolDefinition } from '@/features/registry/types';
import { ToolCard } from './ToolCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';

export interface ToolGridProps {
  tools: ToolDefinition[];
  onClearFilters?: () => void;
  className?: string;
}

export const ToolGrid: React.FC<ToolGridProps> = ({
  tools,
  onClearFilters,
  className,
}) => {
  if (tools.length === 0) {
    return (
      <EmptyState
        title="No tools found"
        description="Try adjusting your search query or selecting a different category."
        actionLabel="Clear filters"
        onAction={onClearFilters}
      />
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
};
