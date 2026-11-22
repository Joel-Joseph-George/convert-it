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

  it('maps NO_TABLES_FOUND to warning with OCR guidance', () => {
    const view = errorToView({ code: 'NO_TABLES_FOUND' });
    expect(view.title).toBe('No tables found');
    expect(view.severity).toBe('warning');
    expect(view.message).toContain('Scanned PDFs may need OCR');
  });

  it('maps PROVIDER_QUOTA_EXHAUSTED and PROVIDER_RATE_LIMITED to friendly warnings', () => {
    const quotaView = errorToView({ code: 'PROVIDER_QUOTA_EXHAUSTED' });
    expect(quotaView.title).toBe('Gemini Quota Exhausted');
    expect(quotaView.severity).toBe('warning');
    expect(quotaView.message).toContain('daily token or request limit');

    const rateView = errorToView({ code: 'PROVIDER_RATE_LIMITED' });
    expect(rateView.title).toBe('Rate Limit Reached');
    expect(rateView.severity).toBe('warning');
    expect(rateView.actionLabel).toBe('Retry');

    const authView = errorToView({ code: 'PROVIDER_AUTH_ERROR' });
    expect(authView.title).toBe('Invalid Gemini API Key');
    expect(authView.severity).toBe('error');
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
