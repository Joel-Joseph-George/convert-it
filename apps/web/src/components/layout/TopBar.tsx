import * as React from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { ArrowLeftRight, LayoutGrid, Search } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/button';

export const TopBar: React.FC = () => {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const isToolsActive = currentPath.startsWith('/tools');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Brand Wordmark */}
        <Link
          to="/"
          className="flex items-center gap-2 text-base font-semibold transition-opacity hover:opacity-90"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-btn bg-primary/10 text-primary">
            <ArrowLeftRight className="h-4 w-4 stroke-[2]" />
          </div>
          <span>
            <span className="text-foreground">Convert</span>
            <span className="text-primary">It</span>
          </span>
        </Link>

        {/* Right Actions: All tools, Search, Theme Toggle */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/tools"
            className={`flex items-center gap-1.5 rounded-btn px-3 py-1.5 text-xs font-medium transition-colors ${
              isToolsActive
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5 stroke-[1.75]" />
            <span>All tools</span>
          </Link>

          <Link
            to="/tools"
            aria-label="Search tools"
          >
            <Button
              variant="ghost"
              size="iconSm"
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Search className="h-4 w-4 stroke-[1.75]" />
            </Button>
          </Link>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
