import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useSettingsStore } from '@/features/settings/settingsStore';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    useSettingsStore.setState({ theme: 'light' });
  });

  it('renders theme toggle button', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /switch to dark theme/i });
    expect(button).toBeInTheDocument();
  });

  it('toggles from light to dark and applies dark class', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /switch to dark theme/i });
    fireEvent.click(button);

    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('convertit_theme')).toBe('dark');
  });

  it('toggles from dark to light', () => {
    useSettingsStore.setState({ theme: 'dark' });
    document.documentElement.classList.add('dark');

    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /switch to light theme/i });
    fireEvent.click(button);

    expect(useSettingsStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('convertit_theme')).toBe('light');
  });
});
