import * as React from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Play, Cpu, ShieldCheck } from 'lucide-react';
import { getToolById } from '@/features/registry/tools';
import { useQueueStore } from '@/features/queue/queueStore';
import { EngineBadge } from '@/components/shared/EngineBadge';
import { PrivacyLine } from '@/components/shared/PrivacyLine';
import { DropZone } from '@/components/tool/DropZone';
import { FormatPills } from '@/components/tool/FormatPills';
import { OptionsPanel } from '@/components/tool/OptionsPanel';
import { ChainEditor, ConversionLibrary } from '@/components/tool/ConversionWorkflow';
import { defaultStep, nextTools, type Step } from '@/features/workflows/conversion';
import { FileQueue } from '@/components/tool/FileQueue';
import { DataPreviewTable } from '@/components/tool/DataPreviewTable';
import { Button } from '@/components/ui/button';
import { useServerHealth } from '@/features/server/useServerHealth';
import { ServerWakeBanner } from '@/features/server/ServerWakeBanner';
import { ErrorAlert } from '@/components/shared/ErrorAlert';

export const Route = createFileRoute('/tools/$toolId')({
  component: ToolPage,
});

const ChatPdfPage = React.lazy(() => import('@/tools/chat-pdf/ChatPdfPage'));
const ImageEditorPage = React.lazy(() => import('@/tools/image-editor/ImageEditorPage'));
const YouTubePage = React.lazy(() => import('@/tools/youtube/YouTubePage'));

function ToolPage(): React.ReactElement {
  const { toolId } = Route.useParams();
  if (toolId === 'chat-pdf') {
    return <React.Suspense fallback={<p role="status">Opening chat…</p>}><ChatPdfPage /></React.Suspense>;
  }
  if (toolId === 'image-editor') {
    return <React.Suspense fallback={<p role="status">Opening editor…</p>}><ImageEditorPage /></React.Suspense>;
  }
  if (toolId === 'youtube') {
    return <React.Suspense fallback={<p role="status">Opening downloader…</p>}><YouTubePage /></React.Suspense>;
  }
  return <ConverterPage key={toolId} toolId={toolId} />;
}

function ConverterPage({ toolId }: { toolId: string }): React.ReactElement {
  const tool = getToolById(toolId);
  const navigate = useNavigate();
  const [tail, setTail] = React.useState<Step[]>([]);

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
    startConversion,
    historyError,
    downloadAllZip,
  } = useQueueStore();

  const { isWakingUp, serverError, limits } = useServerHealth();

  const isServerTool = tool?.engine.kind === 'server';
  const usesServer = isServerTool || tail.some(step => getToolById(step.toolId)?.engine.kind === 'server');
  const isToolUnavailable =
    limits?.serverTools !== undefined &&
    [toolId, ...tail.map(step => step.toolId)].some(id => limits.serverTools?.[id] === false);

  const effectiveMaxFileSizeMB =
    (isServerTool && limits?.maxUploadMB
      ? limits.maxUploadMB
      : tool?.limits.maxFileSizeMB) ?? 25;
  const currentFormat = selectedFormat[toolId] || tool?.outputs[0]?.value || '';
  const currentOptions = options[toolId] || {};
  const toolItems = items[toolId] || [];

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
    void startConversion(tool.id, tail);
  };

  const first = { toolId, format: currentFormat, options: { ...defaultStep(tool).options, ...currentOptions } };
  const changeFormat = (format: string) => {
    setTargetFormat(tool.id, format);
    if (tail[0] && !nextTools({ ...first, format }).some(candidate => candidate.id === tail[0]?.toolId)) {
      setTail([]);
    }
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

        <PrivacyLine engine={usesServer ? 'server' : 'browser'} />
      </div>

      {/* Server wake up banner */}
      {usesServer && isWakingUp && <ServerWakeBanner />}

      {/* Server offline error */}
      {usesServer && serverError && (
        <ErrorAlert
          error={{
            code: 'SERVER_OFFLINE',
            message: 'The conversion server is currently offline or unreachable.',
          }}
        />
      )}

      {/* Server tool disabled error */}
      {isToolUnavailable && (
        <ErrorAlert
          error={{
            code: 'TOOL_DISABLED',
            message: 'This tool is unavailable on the server because the required system engine is not installed.',
          }}
        />
      )}

      {/* DropZone */}
      <DropZone
        onFilesAdded={handleFilesAdded}
        acceptedExtensions={tool.inputs.extensions}
        maxFileSizeMB={effectiveMaxFileSizeMB}
        multiple={tool.inputs.multiple}
        compact={toolItems.length > 0}
        categoryName={tool.category}
      />

      {/* Data Preview Table for Tabular Data Tools */}
      {tool.category === 'data' && toolItems.length > 0 && (
        <DataPreviewTable file={toolItems[0]?.file} />
      )}

      {/* File Queue */}
      <FileQueue
        items={toolItems}
        onRemoveItem={(id) => removeItem(tool.id, id)}
        onClearQueue={() => clearQueue(tool.id)}
        onRetryItem={handleConvert}
        onDownloadAllZip={() => downloadAllZip(tool.id)}
      />

      {/* Target Format Selector */}
      <FormatPills
        outputs={tool.outputs}
        selectedFormat={currentFormat}
        onSelectFormat={changeFormat}
      />

      {/* Tool Options */}
      {tool.options.length > 0 && (
        <OptionsPanel
          options={tool.options}
          values={currentOptions}
          onChange={(optId, val) => setOption(tool.id, optId, val)}
        />
      )}

      <ChainEditor first={first} tail={tail} onChange={setTail} />
      <ConversionLibrary
        first={first} busy={isConverting} storageError={historyError}
        apply={preset => {
          changeFormat(preset.format);
          for (const [id, value] of Object.entries({ ...defaultStep(tool).options, ...preset.options })) {
            setOption(tool.id, id, value);
          }
        }}
        replay={async ([initial, ...following], files) => {
          if (!initial || !getToolById(initial.toolId)) throw new Error('This tool is no longer available.');
          await startConversion(initial.toolId, following, { first: initial, files });
          if (initial.toolId !== toolId) {
            await navigate({ to: '/tools/$toolId', params: { toolId: initial.toolId } });
          }
        }}
      />

      {/* Main Convert Action Button */}
      {toolItems.length > 0 && (
        <div className="pt-2">
          <Button
            size="lg"
            onClick={handleConvert}
            disabled={!hasPendingItems || isConverting || isToolUnavailable}
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
            {!usesServer
              ? 'WASM Sandbox Active • Client Memory'
              : 'Server Sandbox • Ephemeral Isolation'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span>{usesServer ? 'Server processing' : 'Local processing'}</span>
          <span>•</span>
          <span className="flex items-center gap-1 text-success">
            <ShieldCheck className="h-3.5 w-3.5" />
            {usesServer ? 'Ephemeral jobs' : 'On this device'}
          </span>
        </div>
      </div>
    </div>
  );
}
