import * as React from "react";
import {
  Camera,
  CalendarClock,
  MapPin,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { MetadataSummary } from "@/features/engines/imageMetadata";

/** Shows what each queued photo reveals (camera, date, GPS) before it's stripped. */
export function MetadataPreview({
  files,
}: {
  files: File[];
}): React.ReactElement | null {
  const shown = files.slice(0, 6);
  const [summaries, setSummaries] = React.useState<Map<File, MetadataSummary>>(
    new Map(),
  );

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { readMetadata } = await import("@/features/engines/imageMetadata");
      for (const file of shown) {
        if (summaries.has(file)) continue;
        const summary = await readMetadata(file);
        if (cancelled) return;
        setSummaries((prev) => new Map(prev).set(file, summary));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read only when the files change
  }, [shown.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join("|")]);

  if (shown.length === 0) return null;

  return (
    <section
      aria-label="Metadata found"
      className="space-y-2 rounded-card border border-border bg-card p-4"
    >
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        What these photos reveal
      </h2>
      <ul className="divide-y divide-border">
        {shown.map((file) => {
          const info = summaries.get(file);
          return (
            <li
              key={`${file.name}-${file.lastModified}`}
              className="space-y-1 py-2 text-xs"
            >
              <p className="truncate font-medium text-foreground">
                {file.name}
              </p>
              {!info ? (
                <p className="text-muted-foreground">Reading…</p>
              ) : info.fieldCount === 0 ? (
                <p className="flex items-center gap-1.5 text-success">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  No metadata found
                </p>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  {info.location && (
                    <span className="flex items-center gap-1 font-medium text-warning">
                      <MapPin className="h-3.5 w-3.5" />
                      Location {info.location.latitude.toFixed(4)},{" "}
                      {info.location.longitude.toFixed(4)}
                    </span>
                  )}
                  {info.camera && (
                    <span className="flex items-center gap-1">
                      <Camera className="h-3.5 w-3.5" />
                      {info.camera}
                    </span>
                  )}
                  {info.taken && (
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {info.taken}
                    </span>
                  )}
                  {info.software && (
                    <span className="flex items-center gap-1">
                      <Wrench className="h-3.5 w-3.5" />
                      {info.software}
                    </span>
                  )}
                  <span>{info.fieldCount} fields in total</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {files.length > shown.length && (
        <p className="text-[11px] text-muted-foreground">
          and {files.length - shown.length} more…
        </p>
      )}
    </section>
  );
}
