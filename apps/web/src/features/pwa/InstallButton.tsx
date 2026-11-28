import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallStore } from "./installPrompt";

/** "Install app" in the top bar, only when this browser can install ConvertIt. */
export function InstallButton(): React.ReactElement | null {
  const mode = useInstallStore((s) => s.mode);
  const install = useInstallStore((s) => s.install);
  const [showIosHelp, setShowIosHelp] = React.useState(false);

  if (!mode) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => (mode === "ios" ? setShowIosHelp(true) : void install())}
        className="gap-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Install ConvertIt as an app"
      >
        <Download className="h-3.5 w-3.5 stroke-[1.75]" />
        <span className="hidden sm:inline">Install app</span>
      </Button>

      <Dialog.Root open={showIosHelp} onOpenChange={setShowIosHelp}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-card p-5 text-foreground shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="text-sm font-semibold">
                Install ConvertIt
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost" size="iconSm" aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-2 text-xs text-muted-foreground">
              Add it to your home screen to open it like an app, full screen.
            </Dialog.Description>
            <ol className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn bg-muted">
                  <Share className="h-4 w-4" />
                </span>
                <span>
                  Tap <strong>Share</strong> in Safari&apos;s toolbar.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn bg-muted">
                  <SquarePlus className="h-4 w-4" />
                </span>
                <span>
                  Choose <strong>Add to Home Screen</strong>, then{" "}
                  <strong>Add</strong>.
                </span>
              </li>
            </ol>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
