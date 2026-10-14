import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { AppBundle, Check, ProductSpec } from "../lib/contracts";
import type { BuildRecord } from "../lib/build-plan";
import { validateScopedBundle } from "./build-policy";
import { bundleSchema } from "../lib/contracts";
import {
  prepareProject,
  buildProject,
  releaseWorkspace,
  startPreview,
  readPreviewResponse,
  readProjectFiles,
} from "./app-workspaces";

export function inspectProject(
  bundle: AppBundle,
  spec: ProductSpec,
  record?: BuildRecord,
): Check[] {
  const checks: Check[] = [];
  try {
    if (!record) throw new Error("A feasible financial build record is required.");
    bundleSchema.parse(bundle);
    validateScopedBundle(bundle, record);
    if (bundle.manifest.protocol !== spec.protocol)
      throw new Error("Retain the recorded transport protocol.");
    checks.push({
      name: "Financial contract and protected starter",
      passed: true,
      detail:
        "Fixed SDK, financial modules, shadcn source and build configuration match the approved platform starter and contract.",
    });
  } catch (error) {
    checks.push({
      name: "Financial contract and protected starter",
      passed: false,
      detail: error instanceof Error ? error.message : "Invalid financial project",
    });
  }
  checks.push({
    name: "No embedded credentials",
    passed:
      !/sk-(?:proj-)?[a-zA-Z0-9_-]{20,}|Bearer\s+[a-zA-Z0-9_-]{20,}|(?:api[_-]?key|token|password)\s*[:=]\s*["'][^"']{12,}/i.test(
        JSON.stringify(bundle.files),
      ),
    detail: "Potential credentials prevent release.",
  });
  return checks;
}

export async function verifyProject(
  bundle: AppBundle,
  spec: ProductSpec,
  record?: BuildRecord,
  signal?: AbortSignal,
) {
  const checks = inspectProject(bundle, spec, record);
  let thumbnail: { html: string; css: string } | undefined;
  if (checks.every((check) => check.passed)) {
    let workspace;
    try {
      workspace = await prepareProject(bundle, { scope: `verify:${record!.id}`, pin: true });
      await buildProject(workspace, { signal });
      signal?.throwIfAborted();
      const preview = await startPreview(workspace);
      const response = await readPreviewResponse(preview, "/");
      const html = await response.text();
      if (
        response.status !== 200 ||
        !html.includes("Synthetic demo") ||
        !html.includes("financial-react-v1")
      )
        throw new Error(
          "The compiled app did not render its fixed financial modules and synthetic label.",
        );
      const output = await readProjectFiles(workspace);
      for (const [name, source] of Object.entries(bundle.files))
        if (name !== "src/routeTree.gen.ts" && output[name] !== source)
          throw new Error(`Build execution changed source: ${name}`);
      // Capture layout only. Gallery CSP and an empty iframe sandbox disable all execution and requests.
      const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? "";
      const clean = body.replace(/<script\b[\s\S]*?<\/script>/gi, "").slice(0, 30000);
      const assets = path.join(workspace.directory, "dist/client/assets");
      const cssFiles = (await readdir(assets)).filter((name) => name.endsWith(".css"));
      const css = (
        await Promise.all(cssFiles.map((name) => readFile(path.join(assets, name), "utf8")))
      )
        .join("\n")
        .slice(0, 120000);
      thumbnail = { html: clean, css };
      checks.push({
        name: "Platform build, type checks and financial render",
        passed: true,
        detail:
          "Platform-owned Vite+ commands compiled the pinned project inside Linux isolation. SSR rendered the fixed financial module; source remained unchanged.",
      });
    } catch (error) {
      checks.push({
        name: "Platform build, type checks and financial render",
        passed: false,
        detail:
          error instanceof Error ? error.message.slice(-12000) : "Project verification failed",
      });
    } finally {
      if (workspace) await releaseWorkspace(workspace);
    }
  }
  return { checks, thumbnail };
}
