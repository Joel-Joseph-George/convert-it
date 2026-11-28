import * as React from 'react';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Analytics } from '@vercel/analytics/react';
import { TopBar } from '@/components/layout/TopBar';
import { Footer } from '@/components/layout/Footer';
import { AccessCodeDialog } from '@/features/settings/AccessCodeDialog';

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent(): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-foreground">
      <TopBar />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Outlet />
      </main>
      <Footer />
      <AccessCodeDialog />
      {import.meta.env.PROD && <Analytics />}
    </div>
  );
}

function NotFoundComponent(): React.ReactElement {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="rounded-card border border-border bg-card p-8 max-w-md w-full">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          404 Not Found
        </span>
        <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The tool or page you requested does not exist or has moved.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-btn bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
