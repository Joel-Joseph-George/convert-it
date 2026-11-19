import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CategoryChipsProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  className?: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'pdf', label: 'PDF' },
  { id: 'image', label: 'Image' },
  { id: 'audio', label: 'Audio' },
  { id: 'video', label: 'Video' },
  { id: 'documents', label: 'Documents' },
  { id: 'data', label: 'Data' },
  { id: 'text', label: 'Text' },
];

export const CategoryChips: React.FC<CategoryChipsProps> = ({
  selectedCategory,
  onSelectCategory,
  className,
}) => {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {CATEGORIES.map((cat) => {
        const isSelected = selectedCategory === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            className={cn(
              'rounded-chip px-3 py-1.5 text-xs font-medium transition-colors',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
};
