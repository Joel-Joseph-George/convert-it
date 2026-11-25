import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';

describe('Footer', () => {
  it('renders "Made for personal use"', () => {
    render(<Footer />);
    expect(screen.getByText(/made for personal use/i)).toBeInTheDocument();
  });

  it('renders GitHub link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: /convertit on github/i });
    expect(link).toHaveAttribute('href', 'https://github.com/Joel-Joseph-George/convert-it');
  });
});
