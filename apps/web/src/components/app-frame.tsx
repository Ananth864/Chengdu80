import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@web-starter/ui/components/alert";
import { Badge } from "@web-starter/ui/components/badge";
import { cn } from "@web-starter/ui/lib/utils";
import type { Application, Release } from "../lib/contracts";
import { api } from "../lib/client";

export function AppFrame({
  app,
  release,
  frameClassName,
}: {
  app: Application;
  release: Release;
  frameClassName?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const nonce = useMemo(() => crypto.randomUUID().replaceAll("-", ""), [release.id, app.revision]);
  const onFrameLoad = useMemo(() => {
    let loads = 0;
    return () => {
      if (++loads > 1) {
        setReady(false);
        setError(
          "Application navigation was blocked or left the isolated preview. Review the app source.",
        );
      }
    };
  }, [nonce]);
  useEffect(() => {
    setReady(false);
    setError("");
    let calls = 0;
    let outstanding = 0;
    const receive = async (event: MessageEvent) => {
      const m = event.data;
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== "null" ||
        !m ||
        m.channel !== "cd80" ||
        m.nonce !== nonce
      )
        return;
      if (m.ready) {
        setReady(true);
        return;
      }
      if (typeof m.id !== "string" || typeof m.capability !== "string") return;
      if (++calls > 250 || outstanding >= 5) {
        event.source?.postMessage(
          {
            channel: "cd80-result",
            nonce,
            id: m.id,
            error: "Preview capability rate limit reached",
          },
          { targetOrigin: "*" },
        );
        return;
      }
      outstanding++;
      try {
        const result = await api({
          action: "rpc",
          appId: app.id,
          releaseId: release.id,
          capability: m.capability,
          input: m.input,
        });
        frame.current?.contentWindow?.postMessage(
          { channel: "cd80-result", nonce, id: m.id, result },
          "*",
        );
      } catch (e) {
        frame.current?.contentWindow?.postMessage(
          {
            channel: "cd80-result",
            nonce,
            id: m.id,
            error: e instanceof Error ? e.message : "Capability failed",
          },
          "*",
        );
      } finally {
        outstanding--;
      }
    };
    window.addEventListener("message", receive);
    const timer = setTimeout(
      () =>
        setError(
          "If the app stays blank, review its source and browser behavior before accepting it.",
        ),
      15000,
    );
    return () => {
      window.removeEventListener("message", receive);
      clearTimeout(timer);
    };
  }, [app.id, release.id, nonce]);
  const doc = useMemo(() => {
    const sdk = `const pending=new Map();let count=0;window.cd80={call(capability,input={}){return new Promise((resolve,reject)=>{const id=String(++count);const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Capability request timed out'));},100000);pending.set(id,{resolve,reject,timer});parent.postMessage({channel:'cd80',nonce:'${nonce}',id,capability,input},'*');});},ready(){parent.postMessage({channel:'cd80',nonce:'${nonce}',ready:true},'*');}};window.addEventListener('message',e=>{const m=e.data;if(e.source!==parent||!m||m.channel!=='cd80-result'||m.nonce!=='${nonce}')return;const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve(m.result);});`;
    const csp = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none';`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${release.bundle.files["style.css"].replace(/<\/style/gi, "<\\/style")}</style></head><body>${release.bundle.files["index.html"]}<script nonce="${nonce}">${sdk}</script><script nonce="${nonce}" type="module">${release.bundle.files["app.js"].replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
  }, [nonce, release.bundle]);
  return (
    <div className="bg-muted/30">
      <div className="flex items-center gap-2 border-b px-4 py-2.5 text-xs text-muted-foreground">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            ready ? "bg-emerald-500" : "bg-amber-500",
          )}
        />
        {ready ? "Application rendered" : "Starting isolated application…"}
        <Badge variant="outline" className="ml-auto hidden sm:inline-flex">
          {app.current?.id === release.id ? "Accepted release" : "Read-only preview"}
        </Badge>
      </div>
      {!ready && error && (
        <Alert className="m-3 border-amber-200 bg-amber-50 text-amber-900">
          <AlertDescription className="text-amber-800">{error}</AlertDescription>
        </Alert>
      )}
      <iframe
        ref={frame}
        onLoad={onFrameLoad}
        key={`${release.id}:${app.revision}`}
        title={`${app.name} application`}
        srcDoc={doc}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className={cn("block w-full border-0", frameClassName ?? "h-[700px]")}
      />
    </div>
  );
}
