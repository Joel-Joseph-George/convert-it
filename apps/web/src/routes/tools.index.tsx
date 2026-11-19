import * as React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';
import { TOOLS } from '@/features/registry/tools';
import { searchTools } from '@/features/registry/search';
import { ToolSearch } from '@/components/tool/ToolSearch';
import { CategoryChips } from '@/components/tool/CategoryChips';
import { ToolGrid } from '@/components/tool/ToolGrid';

interface ToolsSearchParams {
  q?: string;
  category?: string;
}

export const Route = createFileRoute('/tools/')({
  validateSearch: (search: Record<string, unknown>): ToolsSearchParams => {
    return {
      q: typeof search.q === 'string' ? search.q : undefined,
      category: typeof search.category === 'string' ? search.category : undefined,
    };
  },
  component: ToolsPage,
});

function ToolsPage(): React.ReactElement {
  const search = Route.useSearch();
  const q = search.q ?? '';
  const category = search.category ?? 'all';
  const navigate = useNavigate({ from: Route.fullPath });

  const filteredTools = React.useMemo(() => {
    return searchTools(TOOLS, q, category);
  }, [q, category]);

  const handleQueryChange = (newQ: string): void => {
    navigate({
      search: (prev) => ({ ...prev, q: newQ }),
      replace: true,
    });
  };

  const handleCategoryChange = (newCategory: string): void => {
    navigate({
      search: (prev) => ({ ...prev, category: newCategory }),
      replace: true,
    });
  };

  const handleClearFilters = (): void => {
    navigate({
      search: () => ({ q: '', category: 'all' }),
      replace: true,
    });
  };

  return (
    <div className="mx-auto max-w-grid space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span>{TOOLS.length} tools available • Client-first architecture</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl text-foreground">
          All tools
        </h1>
        <p className="text-sm text-muted-foreground">
          Search or browse. Everything is free and ad-free.
        </p>
      </div>

      {/* Search Input with ⌘K */}
      <ToolSearch query={q} onChange={handleQueryChange} />

      {/* Category Chips */}
      <CategoryChips
        selectedCategory={category}
        onSelectCategory={handleCategoryChange}
      />

      {/* Tools Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {filteredTools.length}{' '}
            {filteredTools.length === 1 ? 'tool' : 'tools'}
          </span>
          <span className="hidden sm:inline">Client WASM accelerated</span>
        </div>

        <ToolGrid tools={filteredTools} onClearFilters={handleClearFilters} />
      </div>

      {/* Privacy First Guarantee Note */}
      <div className="flex items-center gap-3 rounded-card border border-border bg-card p-4 text-xs">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 stroke-[1.75]" />
        <div className="space-y-0.5">
          <div className="font-medium text-foreground">Privacy First Guarantee</div>
          <p className="text-muted-foreground">
            Tools labeled "In your browser" execute locally via WebAssembly. Your files never touch a server.
          </p>
        </div>
      </div>
    </div>
  );
}
