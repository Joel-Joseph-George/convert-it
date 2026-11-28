import * as React from 'react';
import { ChevronDown, Sliders } from 'lucide-react';
import { ToolOption } from '@/features/registry/types';
import { cn } from '@/lib/utils';

export interface OptionsPanelProps {
  options: ToolOption[];
  values: Record<string, string | number | boolean>;
  onChange: (optionId: string, value: string | number | boolean) => void;
  className?: string;
  idPrefix?: string;
}

export const OptionsPanel: React.FC<OptionsPanelProps> = ({
  options,
  values,
  onChange,
  className,
  idPrefix = 'opt',
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  if (options.length === 0) return null;

  const basicOptions = options.filter((opt) => !opt.advanced);
  const advancedOptions = options.filter((opt) => opt.advanced);

  const shouldRenderOption = (opt: ToolOption): boolean => {
    if (!opt.showWhen) return true;
    const dependValue = values[opt.showWhen.optionId];
    return dependValue === opt.showWhen.equals;
  };

  const renderControl = (opt: ToolOption): React.ReactElement => {
    const val = values[opt.id] !== undefined ? values[opt.id] : opt.default;

    switch (opt.type) {
      case 'select':
        return (
          <select
            id={`${idPrefix}-${opt.id}`}
            value={String(val)}
            onChange={(e) => onChange(opt.id, e.target.value)}
            className="h-9 w-full rounded-btn border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {opt.choices?.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        );

      case 'slider':
        return (
          <div className="flex items-center gap-3">
            <input
              type="range"
              id={`${idPrefix}-${opt.id}`}
              min={opt.min ?? 0}
              max={opt.max ?? 100}
              step={opt.step ?? 1}
              value={Number(val)}
              onChange={(e) => onChange(opt.id, Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-primary"
            />
            <span className="w-10 text-right font-mono text-xs text-muted-foreground">
              {Number(val)}%
            </span>
          </div>
        );

      case 'toggle':
        return (
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              id={`${idPrefix}-${opt.id}`}
              checked={Boolean(val)}
              onChange={(e) => onChange(opt.id, e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-5 w-9 rounded-full bg-border peer-checked:bg-primary transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-card after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
          </label>
        );

      case 'number':
        return (
          <input
            type="number"
            id={`${idPrefix}-${opt.id}`}
            value={Number(val) || ''}
            onChange={(e) => onChange(opt.id, Number(e.target.value))}
            min={opt.min}
            max={opt.max}
            className="h-9 w-full rounded-btn border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );

      case 'text':
      default:
        return (
          <input
            type={opt.secret ? 'password' : 'text'}
            autoComplete={opt.secret ? 'off' : undefined}
            id={`${idPrefix}-${opt.id}`}
            value={String(val)}
            onChange={(e) => onChange(opt.id, e.target.value)}
            className="h-9 w-full rounded-btn border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );
    }
  };

  return (
    <div className={cn('rounded-card border border-border bg-card divide-y divide-border', className)}>
      {/* Basic Options */}
      {basicOptions.length > 0 && (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Sliders className="h-3.5 w-3.5 text-primary stroke-[1.75]" />
            <span>Options</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {basicOptions.filter(shouldRenderOption).map((opt) => (
              <div key={opt.id} className="space-y-1.5">
                <label
                  htmlFor={`${idPrefix}-${opt.id}`}
                  className="block text-xs font-medium text-muted-foreground"
                >
                  {opt.label}
                </label>
                {renderControl(opt)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Options Accordion */}
      {advancedOptions.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <span>Advanced parameters</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-200 stroke-[1.75]',
                isOpen && 'rotate-180'
              )}
            />
          </button>

          {isOpen && (
            <div className="p-4 pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20">
              {advancedOptions.filter(shouldRenderOption).map((opt) => (
                <div key={opt.id} className="space-y-1.5">
                  <label
                    htmlFor={`${idPrefix}-${opt.id}`}
                    className="block text-xs font-medium text-muted-foreground"
                  >
                    {opt.label}
                  </label>
                  {renderControl(opt)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
