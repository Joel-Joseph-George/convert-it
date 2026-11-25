import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getToolById } from '@/features/registry/tools';
import {
  defaultStep,
  nextTools,
  type Step,
} from '@/features/workflows/conversion';
import {
  clearHistory,
  deletePreset,
  libraryChanged,
  listHistory,
  listPresets,
  loadInputs,
  savePreset,
  type Preset,
  type RecentRun,
} from '@/features/workflows/library';
import { OptionsPanel } from './OptionsPanel';

const field = 'rounded-btn border border-border bg-card px-2 py-1.5 text-sm';
const section =
  'space-y-3 rounded-card border border-border bg-card p-4 text-sm';

export function ChainEditor({
  first,
  tail,
  onChange,
}: {
  first: Step;
  tail: Step[];
  onChange: (tail: Step[]) => void;
}) {
  const next = nextTools(tail.at(-1) ?? first);
  if (!next.length && !tail.length) return null;
  return (
    <section className={section} aria-label="Conversion steps">
      {tail.map((step, index) => {
        const tool = getToolById(step.toolId);
        if (!tool) return null;
        const replace = (updated: Step) => {
          const following = tail.slice(index + 1);
          if (
            following[0] &&
            !nextTools(updated).some((t) => t.id === following[0]?.toolId)
          ) {
            following.length = 0;
          }
          onChange([...tail.slice(0, index), updated, ...following]);
        };
        return (
          <div className="space-y-2 border-b border-border pb-3" key={index}>
            <div className="flex flex-wrap items-center gap-2">
              <strong>
                Step {index + 2} · {tool.name}
              </strong>
              <select
                className={field}
                aria-label={`Step ${index + 2} output format`}
                value={step.format}
                onChange={(event) =>
                  replace({ ...step, format: event.target.value })
                }
              >
                {tool.outputs.map((out) => (
                  <option key={out.value} value={out.value}>
                    {out.label}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange(tail.slice(0, index))}
              >
                Remove from here
              </Button>
            </div>
            {tool.engine.kind === 'server' && (
              <p>This step uploads its input to the conversion server.</p>
            )}
            <OptionsPanel
              options={tool.options}
              values={step.options}
              idPrefix={`step-${index + 2}`}
              onChange={(id, value) =>
                replace({ ...step, options: { ...step.options, [id]: value } })
              }
            />
          </div>
        );
      })}
      {next.length > 0 && (
        <label className="flex flex-wrap items-center gap-2">
          Next conversion
          <select
            className={field}
            value=""
            onChange={(event) => {
              const tool = next.find(
                (candidate) => candidate.id === event.target.value
              );
              if (tool) onChange([...tail, defaultStep(tool)]);
            }}
          >
            <option value="">Add a compatible tool…</option>
            {next.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.name}
                {tool.engine.kind === 'server' ? ' (server upload)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}

export function ConversionLibrary({
  first,
  apply,
  replay,
  busy,
  storageError,
}: {
  first: Step;
  apply: (step: Step) => void;
  replay: (steps: Step[], files: File[]) => Promise<void>;
  busy: boolean;
  storageError: string;
}) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [history, setHistory] = useState<RecentRun[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [loadingRun, setLoadingRun] = useState(false);
  useEffect(() => {
    let generation = 0;
    const refresh = async () => {
      const version = ++generation;
      try {
        const [saved, recent] = await Promise.all([
          listPresets(),
          listHistory(),
        ]);
        if (version !== generation) return;
        setPresets(saved.filter((item) => item.toolId === first.toolId));
        setHistory(recent.reverse());
      } catch {
        if (version === generation)
          setMessage('Browser storage is unavailable.');
      }
    };
    void refresh();
    window.addEventListener(libraryChanged, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      generation++;
      window.removeEventListener(libraryChanged, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [first.toolId]);

  async function perform(action: () => Promise<void>, success = '') {
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Browser storage is unavailable.'
      );
    }
  }
  return (
    <div className="space-y-3">
      <details className={section}>
        <summary className="cursor-pointer font-medium">Tool presets</summary>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim())
              void perform(
                () => savePreset({ ...first, name: name.trim() }),
                'Preset saved.'
              );
          }}
        >
          <input
            className={field}
            aria-label="Preset name"
            placeholder="Preset name"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button size="sm" variant="secondary" disabled={!name.trim()}>
            Save preset
          </Button>
        </form>
        {presets.map((preset) => (
          <div className="flex flex-wrap items-center gap-2" key={preset.name}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                apply(preset);
                setName(preset.name);
                setMessage('Preset applied.');
              }}
            >
              Apply {preset.name}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete preset ${preset.name}`}
              onClick={() =>
                void perform(() => deletePreset(preset), 'Preset deleted.')
              }
            >
              Delete
            </Button>
          </div>
        ))}
      </details>
      <details className={section}>
        <summary className="cursor-pointer font-medium">
          Recent conversions
        </summary>
        <p className="text-muted-foreground">
          This browser keeps inputs and settings for your last 20 conversions.
        </p>
        {history.map((run) => (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2"
            key={run.id}
          >
            <div className="min-w-0">
              <p className="break-all font-medium">{run.names.join(', ')}</p>
              <p className="text-xs text-muted-foreground">
                {run.steps
                  .map(
                    (step) =>
                      `${getToolById(step.toolId)?.name ?? step.toolId} (${step.format.toUpperCase()})`
                  )
                  .join(' → ')}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || loadingRun}
              onClick={() => {
                setLoadingRun(true);
                void perform(async () => {
                  const files = await loadInputs(run.id);
                  if (!files?.length)
                    throw new Error(
                      'These inputs are no longer in browser storage.'
                    );
                  await replay(run.steps, files);
                }).finally(() => setLoadingRun(false));
              }}
            >
              {run.steps.some(
                (step) => getToolById(step.toolId)?.engine.kind === 'server'
              )
                ? 'Re-run with server upload'
                : 'Re-run'}
            </Button>
          </div>
        ))}
        {history.length ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void perform(clearHistory, 'History cleared.')}
          >
            Clear all history
          </Button>
        ) : (
          <p>No recent conversions.</p>
        )}
      </details>
      {(message || storageError) && (
        <p role="status" className="text-sm">
          {[message, storageError].filter(Boolean).join(' ')}
        </p>
      )}
    </div>
  );
}
