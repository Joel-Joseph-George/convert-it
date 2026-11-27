import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "./settingsStore";

/**
 * Asks for the server's access code. Opened when /api/limits says one is required
 * and none is stored, or when a server call comes back AUTH_REQUIRED.
 */
export function AccessCodeDialog(): React.ReactElement {
  const open = useSettingsStore((s) => s.accessPromptOpen);
  const storedCode = useSettingsStore((s) => s.accessCode);
  const setAccessCode = useSettingsStore((s) => s.setAccessCode);
  const closeAccessPrompt = useSettingsStore((s) => s.closeAccessPrompt);
  const [code, setCode] = React.useState(storedCode);

  React.useEffect(() => {
    if (open) setCode(storedCode);
  }, [open, storedCode]);

  const save = (event: React.FormEvent): void => {
    event.preventDefault();
    setAccessCode(code.trim());
    closeAccessPrompt();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => !next && closeAccessPrompt()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-card p-5 text-foreground shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <Dialog.Title className="text-sm font-semibold">
                Access code
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="iconSm" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-xs text-muted-foreground">
            This server needs an access code for server tools (YouTube, PDF to
            Word, Office conversions, PDF chat). It is saved in this browser
            only.
          </Dialog.Description>
          <form onSubmit={save} className="mt-4 space-y-3">
            <input
              type="password"
              autoComplete="off"
              autoFocus
              aria-label="Access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter access code"
              className="h-10 w-full rounded-btn border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex justify-end gap-2">
              {storedCode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAccessCode("");
                    closeAccessPrompt();
                  }}
                >
                  Forget code
                </Button>
              )}
              <Button type="submit" size="sm" disabled={!code.trim()}>
                Save
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
