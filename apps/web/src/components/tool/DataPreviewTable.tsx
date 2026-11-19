import * as React from 'react';
import { Table as TableIcon } from 'lucide-react';
import type { DataPreview } from '@/features/engines/dataEngine';
import { cn } from '@/lib/utils';

export interface DataPreviewTableProps {
  file?: File;
  className?: string;
}

export const DataPreviewTable: React.FC<DataPreviewTableProps> = ({
  file,
  className,
}) => {
  const [preview, setPreview] = React.useState<DataPreview | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    import('@/features/engines/dataEngine')
      .then((m) => m.getPreviewRows(file))
      .then((data) => {
        if (isMounted) {
          setPreview(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError((err as Error).message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [file]);

  if (!file || (!preview && !loading && !error)) return null;

  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card overflow-hidden',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/20">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <TableIcon className="h-3.5 w-3.5 text-primary stroke-[1.75]" />
          <span>Preview: {file.name}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">Showing first 5 rows</span>
      </div>

      {loading && (
        <div className="p-4 text-center text-xs text-muted-foreground">
          Loading preview...
        </div>
      )}

      {error && (
        <div className="p-4 text-center text-xs text-muted-foreground">
          {error}
        </div>
      )}

      {preview && preview.headers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                {preview.headers.map((h, i) => (
                  <th key={i} className="px-3.5 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {preview.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-muted/20">
                  {preview.headers.map((_, colIdx) => (
                    <td
                      key={colIdx}
                      className="px-3.5 py-2 text-foreground whitespace-nowrap"
                    >
                      {String(row[colIdx] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
