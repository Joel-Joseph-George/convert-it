import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueueStore } from "@/features/queue/queueStore";
import { useYouTubeStore } from "@/features/youtube/youtubeStore";
import { setEditorHandoff } from "@/tools/image-editor/handoff";
import {
  filesForTool,
  isSharedYouTubeLink,
  pickToolForFiles,
  takeSharedContent,
} from "@/features/share/shareInbox";

export const Route = createFileRoute("/share")({
  component: SharePage,
});

/**
 * Landing page for the Web Share Target ("Share → ConvertIt"). The service worker
 * stores the shared files/text and redirects here; we hand them to the right tool.
 */
function SharePage(): React.ReactElement {
  const navigate = useNavigate();
  const [message, setMessage] = React.useState("Opening what you shared…");
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      const { text, files } = await takeSharedContent().catch(() => ({
        text: "",
        files: [],
      }));

      const tool = pickToolForFiles(files);
      if (tool) {
        const accepted = filesForTool(tool, files);
        if (tool.id === "image-editor") {
          setEditorHandoff({ file: accepted[0] });
        } else {
          useQueueStore
            .getState()
            .addFiles(tool.id, accepted, tool.outputs[0]?.value ?? "");
        }
        await navigate({
          to: "/tools/$toolId",
          params: { toolId: tool.id },
          replace: true,
        });
        return;
      }

      const youtubeUrl = isSharedYouTubeLink(text);
      if (youtubeUrl) {
        const youtube = useYouTubeStore.getState();
        youtube.reset();
        youtube.setUrl(youtubeUrl);
        void youtube.fetchInfo(youtubeUrl);
        await navigate({
          to: "/tools/$toolId",
          params: { toolId: "youtube" },
          replace: true,
        });
        return;
      }

      if (files.length > 0) {
        setMessage("ConvertIt doesn't have a tool for this file type yet.");
        return;
      }
      await navigate({ to: "/", replace: true });
    })();
  }, [navigate]);

  return (
    <p
      role="status"
      className="py-12 text-center text-sm text-muted-foreground"
    >
      {message}
    </p>
  );
}
