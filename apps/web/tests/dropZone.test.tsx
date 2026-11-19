import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DropZone } from '@/components/tool/DropZone';

describe('DropZone', () => {
  it('renders standard full-size dropzone with choose files button', () => {
    const handleFiles = vi.fn();
    render(
      <DropZone
        onFilesAdded={handleFiles}
        acceptedExtensions={['mp3', 'wav']}
        maxFileSizeMB={300}
        categoryName="audio files"
      />
    );

    expect(screen.getByText(/drag and drop audio files here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose files/i })).toBeInTheDocument();
    expect(screen.getByText(/up to 300 mb/i)).toBeInTheDocument();
  });

  it('renders compact mode dropzone when compact prop is true', () => {
    render(
      <DropZone
        onFilesAdded={vi.fn()}
        acceptedExtensions={['mp3', 'wav']}
        maxFileSizeMB={300}
        compact={true}
        categoryName="audio files"
      />
    );

    expect(screen.getByText(/drop more audio files here/i)).toBeInTheDocument();
  });
});
