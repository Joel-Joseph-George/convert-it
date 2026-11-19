import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EngineBadge } from '@/components/shared/EngineBadge';

describe('EngineBadge', () => {
  it('renders "In your browser" for browser engine', () => {
    render(<EngineBadge engine="browser" />);
    expect(screen.getByText(/in your browser/i)).toBeInTheDocument();
  });

  it('renders "Server" for server engine', () => {
    render(<EngineBadge engine="server" />);
    expect(screen.getByText('Server')).toBeInTheDocument();
  });

  it('renders "Best effort" badge when specified', () => {
    render(<EngineBadge engine="server" badge="best-effort" />);
    expect(screen.getByText(/best effort/i)).toBeInTheDocument();
  });
});
