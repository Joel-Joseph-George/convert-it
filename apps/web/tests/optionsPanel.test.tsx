import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OptionsPanel } from '@/components/tool/OptionsPanel';
import { ToolOption } from '@/features/registry/types';

describe('OptionsPanel', () => {
  const options: ToolOption[] = [
    {
      id: 'quality',
      label: 'Quality',
      type: 'slider',
      default: 85,
      min: 10,
      max: 100,
    },
    {
      id: 'format',
      label: 'Format Mode',
      type: 'select',
      default: 'fast',
      choices: [
        { value: 'fast', label: 'Fast' },
        { value: 'high', label: 'High' },
      ],
    },
    {
      id: 'stripExif',
      label: 'Strip Exif',
      type: 'toggle',
      default: true,
      advanced: true,
    },
  ];

  it('renders standard options and toggles advanced options', () => {
    const handleChange = vi.fn();
    render(
      <OptionsPanel
        options={options}
        values={{ quality: 85, format: 'fast', stripExif: true }}
        onChange={handleChange}
      />
    );

    expect(screen.getByText('Quality')).toBeInTheDocument();
    expect(screen.getByText('Format Mode')).toBeInTheDocument();

    // Advanced options start collapsed
    expect(screen.queryByText('Strip Exif')).not.toBeInTheDocument();

    // Click to open advanced parameters
    const advancedToggle = screen.getByRole('button', { name: /advanced parameters/i });
    fireEvent.click(advancedToggle);

    expect(screen.getByText('Strip Exif')).toBeInTheDocument();
  });

  it('fires onChange when a select option is modified', () => {
    const handleChange = vi.fn();
    render(
      <OptionsPanel
        options={options}
        values={{ quality: 85, format: 'fast', stripExif: true }}
        onChange={handleChange}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'high' } });
    expect(handleChange).toHaveBeenCalledWith('format', 'high');
  });
});
