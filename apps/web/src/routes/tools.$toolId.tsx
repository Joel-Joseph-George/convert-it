import * as React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Play, Cpu, ShieldCheck } from 'lucide-react';
import { getToolById } from '@/features/registry/tools';
import { useQueueStore } from '@/features/queue/queueStore';
import { EngineBadge } from '@/components/shared/EngineBadge';
import { PrivacyLine } from '@/components/shared/PrivacyLine';
import { DropZone } from '@/components/tool/DropZone';
import { FormatPills } from '@/components/tool/FormatPills';
import { OptionsPanel } from '@/components/tool/OptionsPanel';
import { FileQueue } from '@/components/tool/FileQueue';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/tools/$toolId')({
  component: ToolPage,
});

function ToolPage(): React.ReactElement {
  const { toolId } = Route.useParams();
  const tool = getToolById(toolId);

  const {
    items,
    selectedFormat,
    options,
    addFiles,
    removeItem,
    clearQueue,
    setTargetFormat,
    setOption,
    initOptions,
    startFakeConversion,
  } = useQueueStore();

  const toolItems = items[toolId] || [];
  const currentFormat = selectedFormat[toolId] || tool?.outputs[0]?.value || '';
  const currentOptions = options[toolId] || {};

  React.useEffect(() => {
    if (tool && tool.options.length > 0) {
      const defaults: Record<string, string | number | boolean> = {};
      tool.options.forEach((opt) => {
        defaults[opt.id] = opt.default;
      });
      initOptions(tool.id, defaults);
    }
  }, [tool, initOptions]);

  if (!tool) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <div className="rounded-card border border-border bg-card p-8 max-w-md w-full">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Tool Not Found
          </span>
          <h1 className="mt-2 text-xl font-semibold">Unknown Converter</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No tool with id "{toolId}" exists in the converter registry.
          </p>
          <div className="mt-6">
            <Link to="/tools">
              <Button size="sm">Browse all tools</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleFilesAdded = (files: File[]): void => {
    addFiles(tool.id, files, currentFormat);
  };

  const handleConvert = (): void => {
    startFakeConversion(tool.id);
  };

  const hasPendingItems = toolItems.some(
    (i) => i.status === 'ready' || i.status === 'failed'
  );
  const isConverting = toolItems.some((i) => i.status === 'converting');

  return (
    <div className="mx-auto max-w-content space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          to="/tools"
          search={{ q: '', category: tool.category }}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Tools</span>
        </Link>
        <span>/</span>
        <span className="capitalize text-foreground font-medium">
          {tool.category}
        </span>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl text-foreground">
            {tool.name}
          </h1>
          <EngineBadge engine={tool.engine.kind} badge={tool.badge} />
        </div>

        <p className="text-sm text-muted-foreground">{tool.description}</p>

        {tool.notes && (
          <div className="rounded-btn border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Note: </span>
            {tool.notes}
          </div>
        )}

        <PrivacyLine engine={tool.engine.kind} />
      </div>

      {/* DropZone */}
      <DropZone
        onFilesAdded={handleFilesAdded}
        acceptedExtensions={tool.inputs.extensions}
        maxFileSizeMB={tool.limits.maxFileSizeMB}
        multiple={tool.inputs.multiple}
        compact={toolItems.length > 0}
        categoryName={tool.category}
      />

      {/* File Queue */}
      <FileQueue
        items={toolItems}
        onRemoveItem={(id) => removeItem(tool.id, id)}
        onClearQueue={() => clearQueue(tool.id)}
      />

      {/* Target Format Selector */}
      <FormatPills
        outputs={tool.outputs}
        selectedFormat={currentFormat}
        onSelectFormat={(fmt) => setTargetFormat(tool.id, fmt)}
      />

      {/* Tool Options */}
      {tool.options.length > 0 && (
        <OptionsPanel
          options={tool.options}
          values={currentOptions}
          onChange={(optId, val) => setOption(tool.id, optId, val)}
        />
      )}

      {/* Main Convert Action Button */}
      {toolItems.length > 0 && (
        <div className="pt-2">
          <Button
            size="lg"
            onClick={handleConvert}
            disabled={!hasPendingItems || isConverting}
            className="w-full h-11 text-sm font-medium gap-2 shadow-none"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>
              {isConverting
                ? 'Processing queue...'
                : hasPendingItems
                ? 'Convert remaining files'
                : 'All files converted'}
            </span>
          </Button>
        </div>
      )}

      {/* Footer Engine / Sandbox Status Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border pt-4 text-[11px] font-mono text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary stroke-[1.75]" />
          <span>
            {tool.engine.kind === 'browser'
              ? 'WASM Sandbox Active • Client Memory'
              : 'Server Sandbox • Ephemeral Isolation'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span>0 bps network transfer</span>
          <span>•</span>
          <span className="flex items-center gap-1 text-success">
            <ShieldCheck className="h-3.5 w-3.5" />
            100% Private
          </span>
        </div>
      </div>
    </div>
  );
}
