import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorAlert } from '@/components/shared/ErrorAlert';
import { errorToView } from '@/features/server/errorToView';

describe('ErrorAlert and errorToView', () => {
  it('maps ERR_INVALID_URL to expected message and action', () => {
    const view = errorToView('ERR_INVALID_URL');
    expect(view.title).toContain("look like a YouTube link");
    expect(view.severity).toBe('error');
    expect(view.actionLabel).toBe('Clear');
  });

  it('maps VIDEO_TOO_LONG to warning with "Choose audio only" action', () => {
    const view = errorToView({ code: 'VIDEO_TOO_LONG' });
    expect(view.title).toContain('too long');
    expect(view.severity).toBe('warning');
    expect(view.actionLabel).toBe('Choose audio only');
  });

  it('renders ErrorAlert with title, description, and triggers action callback', () => {
    const handleAction = vi.fn();
    render(
      <ErrorAlert
        error="ERR_INVALID_URL"
        onAction={handleAction}
      />
    );

    expect(screen.getByText(/look like a YouTube link/i)).toBeInTheDocument();
    const actionBtn = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(actionBtn);
    expect(handleAction).toHaveBeenCalledWith('clear');
  });
});
