import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormatPills } from '@/components/tool/FormatPills';

describe('FormatPills', () => {
  const outputs = [
    { value: 'mp3', label: 'MP3' },
    { value: 'wav', label: 'WAV' },
    { value: 'flac', label: 'FLAC' },
  ];

  it('renders all output format chips', () => {
    const handleSelect = vi.fn();
    render(
      <FormatPills
        outputs={outputs}
        selectedFormat="mp3"
        onSelectFormat={handleSelect}
      />
    );

    expect(screen.getByRole('button', { name: 'MP3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WAV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FLAC' })).toBeInTheDocument();
  });

  it('fires onSelectFormat when clicked', () => {
    const handleSelect = vi.fn();
    render(
      <FormatPills
        outputs={outputs}
        selectedFormat="mp3"
        onSelectFormat={handleSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'WAV' }));
    expect(handleSelect).toHaveBeenCalledWith('wav');
  });

  it('returns null if outputs has 1 or fewer formats', () => {
    const { container } = render(
      <FormatPills
        outputs={[{ value: 'pdf', label: 'PDF' }]}
        selectedFormat="pdf"
        onSelectFormat={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
