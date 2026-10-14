import { useEffect, useMemo, useRef, useState } from "react";
import type { Application, Release } from "../lib/contracts";
import { SIMULATION_WARNING } from "@web-starter/capabilities";
import { Alert, AlertTitle, AlertDescription } from "@web-starter/ui/components/alert";
import { api } from "../lib/client";
import { previewDocument } from "../lib/preview-document";
import { UNVERIFIED_WARNING } from "../lib/planning";

export function AppFrame({ app, release }: { app: Application; release: Release }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const canPreview = release.verification.passed || release.simulationPassed === true;
  const nonce = useMemo(() => crypto.randomUUID().replaceAll("-", ""), [release.id]);
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
    if (!canPreview) return;
    let calls = 0;
    let outstanding = 0;
    let logCount = 0;
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
      if (m.log && typeof m.log.message === "string" && ++logCount <= 20) {
        void api({
          action: "browser-log",
          appId: app.id,
          releaseId: release.id,
          level: "error",
          message: m.log.message.slice(0, 2000),
        }).catch(() => {});
        return;
      }
      if (m.ready) {
        setReady(true);
        return;
      }
      if (typeof m.id !== "string" || typeof m.capability !== "string") return;
      // Artifact previews expose only the saved server flow, never arbitrary RPC capabilities.
      if (
        release.capabilityArtifact &&
        (m.capability !== "capability.flow" ||
          !m.input ||
          typeof m.input !== "object" ||
          Array.isArray(m.input) ||
          Object.keys(m.input).length !== 1 ||
          !m.input.inputs ||
          typeof m.input.inputs !== "object" ||
          Array.isArray(m.input.inputs))
      ) {
        event.source?.postMessage(
          {
            channel: "cd80-result",
            nonce,
            id: m.id,
            error: "Only capability.flow with {inputs: Record<string, unknown>} is allowed.",
          },
          { targetOrigin: "*" },
        );
        return;
      }
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
          "If the app stays blank, review its source and browser behavior before continuing.",
        ),
      15000,
    );
    return () => {
      window.removeEventListener("message", receive);
      clearTimeout(timer);
    };
  }, [app.id, release.id, release.capabilityArtifact, canPreview, nonce]);
  const doc = useMemo(() => {
    return previewDocument(release.bundle, nonce);
  }, [nonce, release.bundle]);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {release.capabilityArtifact?.simulation === false ? (
        <Alert className="shrink-0 rounded-none">
          <AlertTitle>Unverified deterministic preview</AlertTitle>
          <AlertDescription>{UNVERIFIED_WARNING}</AlertDescription>
        </Alert>
      ) : (
        (release.capabilityArtifact?.simulation || release.simulationPassed) && (
          <Alert className="shrink-0 rounded-none">
            <AlertTitle>Simulation result only</AlertTitle>
            <AlertDescription>{SIMULATION_WARNING}</AlertDescription>
          </Alert>
        )
      )}
      {!release.verification.passed && (
        <Alert variant="destructive" className="shrink-0 rounded-none">
          <AlertTitle>Unverified release: production blocked</AlertTitle>
          <AlertDescription>
            {canPreview
              ? release.capabilityArtifact?.simulation === false
                ? "Preview tests passed, but production verification has not. This preview is not an approved application."
                : "Simulation passed, but production verification has not. This preview is not an approved application."
              : release.capabilityArtifact?.simulation === false
                ? "Neither verification nor preview tests passed. Preview execution is disabled."
                : "Neither verification nor simulation passed. Preview execution is disabled."}
          </AlertDescription>
        </Alert>
      )}
      {canPreview && !ready && !error && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading preview…
        </p>
      )}
      {!ready && error && (
        <Alert>
          <AlertTitle>Preview needs review</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {canPreview && (
        <iframe
          ref={frame}
          onLoad={onFrameLoad}
          key={release.id}
          title={`${app.name} application`}
          aria-busy={!ready}
          srcDoc={doc}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          className="min-h-0 w-full flex-1 border-0"
        />
      )}
    </div>
  );
}
