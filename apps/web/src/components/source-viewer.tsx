import type { SourcePath } from "./code-workspace";
import { formatSource } from "../server/format-source";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertTitle, AlertDescription } from "@web-starter/ui/components/alert";

// Load Monaco only when Code is opened, and only in the browser.
export function SourceViewer({
  path,
  fileName,
  content,
}: {
  path: string;
  fileName: SourcePath;
  content: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    setError("");
    Promise.all([
      import("./source-viewer-runtime"),
      formatSource({ data: { fileName, content } }).catch(() => content),
    ])
      .then(([{ mountSourceViewer }, formatted]) => {
        if (cancelled || !container.current) return;
        dispose = mountSourceViewer(container.current, path, fileName, formatted);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : "Code viewer failed to load");
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [path, fileName, content]);
  return (
    <div aria-label="Read-only code editor" className="relative min-h-0 min-w-0 flex-1">
      {error ? (
        <div className="absolute inset-0 flex min-h-0 flex-col gap-3 p-3">
          <Alert>
            <AlertTitle>Showing plain-text source</AlertTitle>
            <AlertDescription>
              The enhanced editor could not load. Your saved code is available below. Refresh the
              page to retry the editor. {error}
            </AlertDescription>
          </Alert>
          <pre
            aria-label={`${fileName} source (read-only)`}
            className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted p-3 text-xs"
          >
            <code>{content}</code>
          </pre>
        </div>
      ) : (
        <div ref={container} className="absolute inset-0" />
      )}
    </div>
  );
}
