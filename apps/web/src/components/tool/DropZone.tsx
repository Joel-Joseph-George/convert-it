import * as React from 'react';
import { Upload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DropZoneProps {
  onFilesAdded: (files: File[]) => void;
  acceptedExtensions: string[];
  maxFileSizeMB: number;
  multiple?: boolean;
  compact?: boolean;
  className?: string;
  categoryName?: string;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesAdded,
  acceptedExtensions,
  maxFileSizeMB,
  multiple = true,
  compact = false,
  className,
  categoryName = 'files',
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const acceptString = acceptedExtensions
    .map((ext) => `.${ext.replace(/^\./, '')}`)
    .join(',');

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      const first = droppedFiles[0];
      if (multiple) {
        onFilesAdded(droppedFiles);
      } else if (first) {
        onFilesAdded([first]);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      const first = selected[0];
      if (multiple) {
        onFilesAdded(selected);
      } else if (first) {
        onFilesAdded([first]);
      }
      e.target.value = '';
    }
  };

  const triggerSelect = (): void => {
    inputRef.current?.click();
  };

  if (compact) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerSelect}
        className={cn(
          'group flex cursor-pointer items-center justify-center gap-2 rounded-card border border-dashed p-4 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border-dashed bg-card/60 hover:border-primary/50 hover:bg-card',
          className
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={acceptString}
          onChange={handleFileInput}
          className="sr-only"
        />
        <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors stroke-[2]" />
        <span className="text-xs font-medium text-foreground">
          Drop more {categoryName} here or{' '}
          <span className="text-primary underline-offset-2 hover:underline">
            browse storage
          </span>
        </span>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          ({acceptedExtensions.slice(0, 4).join(', ').toUpperCase()} up to {maxFileSizeMB}MB)
        </span>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed p-8 text-center sm:p-12 transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border-dashed bg-card/60 hover:border-primary/50 hover:bg-card',
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={acceptString}
        onChange={handleFileInput}
        className="sr-only"
      />

      <div className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary/10 text-primary">
        <Upload className="h-5 w-5 stroke-[1.75]" />
      </div>

      <p className="mt-3 text-sm font-medium text-foreground">
        Drag and drop {categoryName} here
      </p>

      <div className="mt-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={triggerSelect}
          className="text-xs"
        >
          Choose files
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Up to {maxFileSizeMB} MB per file • {acceptedExtensions.slice(0, 5).join(', ').toUpperCase()}
      </p>
    </div>
  );
};
