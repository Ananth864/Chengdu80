import { chromium } from "playwright";
import { createHash, randomUUID } from "node:crypto";
import { previewDocument } from "../lib/preview-document";
import type { Application, Release, Check } from "../lib/contracts";
import { calculate, defaultData } from "../lib/finance";
import { assetUniverse, prices } from "./providers";
import { execute } from "./runtime";
import { callPlugin } from "./plugins";
import type { Access } from "./repository";

export function applicationDataHash(data: Record<string, unknown>) {
  return createHash("sha256")
    .update(
      JSON.stringify(data, (_key, value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(
              Object.keys(value)
                .sort()
                .map((key) => [key, value[key]]),
            )
          : value,
      ),
    )
    .digest("hex");
}

let running = false;
// A browser check is bounded and fail-closed. No untrusted UI receives real secrets or writable app storage.
export async function verifyApplication(release: Release, app: Application, access?: Access) {
  const checks: Check[] = [];
  if (running)
    return [
      {
        name: "Application browser verification",
        passed: false,
        detail: "Browser verifier is busy; retry verification.",
      },
    ];
  running = true;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const deadline = setTimeout(() => {
    void browser?.close();
  }, 30000);
  const data = structuredClone(app.data);
  let latestResult: unknown;
  const errors: string[] = [];
  let calls = 0;
  let writes = 0;
  let reads = 0;
  let flows = 0;
  const pluginsUsed = new Set<string>();
  try {
    const savedInputs =
      app.current || app.spec.protocol === release.spec.protocol
        ? data.inputs
        : defaultData(release.spec.protocol);
    data.inputs = savedInputs;
    if (!release.capabilityArtifact) await execute(release.bundle, savedInputs);
    checks.push({
      name: "Saved input compatibility",
      passed: true,
      detail: release.capabilityArtifact
        ? "Pinned capability flow uses its explicit prototype inputs."
        : "Candidate calculations accept the existing saved inputs without changing them.",
    });
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      headless: true,
      timeout: 10000,
      args: ["--disable-dev-shm-usage"],
    });
    const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: { width: 1280, height: 900 },
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on("pageerror", (error) => errors.push(error.message.slice(0, 300)));
    const nonce = randomUUID().replaceAll("-", "");
    await page.exposeFunction("verifyRpc", async (message: { capability: string; input: any }) => {
      if (++calls > 80) throw new Error("Verification capability limit reached");
      const { capability, input } = message;
      if (JSON.stringify(input ?? null).length > 150000)
        throw new Error("Capability input exceeds size limit");
      if (release.capabilityArtifact) {
        if (capability !== "capability.flow") throw new Error("Only the pinned flow is allowed");
        const { runCapabilityPlan, publicCapabilityResult } =
          await import("@web-starter/capabilities/runtime");
        flows++;
        return publicCapabilityResult(
          release.capabilityArtifact.plan,
          await runCapabilityPlan(release.capabilityArtifact.plan, input.inputs),
        );
      }
      if (!release.bundle.manifest.permissions.includes(capability as any))
        throw new Error("Undeclared capability");
      if (capability === "storage.read") {
        reads++;
        return data[input.key] ?? null;
      }
      if (capability === "storage.write") {
        if (!/^[a-zA-Z0-9-][a-zA-Z0-9_-]{0,49}$/.test(input.key))
          throw new Error("Invalid storage key");
        if (input.key === "inputs") await execute(release.bundle, input.value);
        if (JSON.stringify({ ...data, [input.key]: input.value }).length > 150000)
          throw new Error("Shared data exceeds prototype size limit");
        data[input.key] = input.value;
        writes++;
        return { saved: true };
      }
      if (capability === "finance.calculate") {
        latestResult = await execute(release.bundle, input);
        return latestResult;
      }
      if (capability === "finance.portfolio") return calculate("portfolio", input);
      if (capability === "finance.screen") return calculate("screening", input);
      if (capability === "finance.backtest") return calculate("strategy", input);
      if (capability === "market.assets") return assetUniverse();
      if (capability === "market.prices") {
        if (input.provider && input.provider !== "fixtures")
          throw new Error("Browser tests must use fixtures, not live providers");
        return prices({ ...input, provider: "fixtures" });
      }
      if (capability === "ai.explain")
        return "Verification fixture only. No live inference or financial advice.";
      if (capability === "plugin.call") {
        if (!access) throw new Error("Plugin verification needs an owned app context");
        const fixture = release.bundle.manifest.pluginFixtures?.find(
          (entry) => entry.pluginId === input.pluginId && entry.operationId === input.operationId,
        );
        if (!fixture)
          throw new Error(
            "Missing explicit plugin response fixture; provider behavior is unverified",
          );
        await callPlugin(access, input.pluginId, input.operationId, input.parameters ?? {}, {
          appId: app.id,
          validateOnly: true,
          candidate: release.bundle,
        });
        pluginsUsed.add(`${input.pluginId}:${input.operationId}`);
        return fixture.result;
      }
      throw new Error("Unsupported verification capability");
    });
    await page.setContent(
      `<iframe id="candidate" sandbox="allow-scripts" style="width:100%;height:800px;border:0"></iframe>`,
    );
    await page.evaluate((token) => {
      const state = { ready: false, errors: [] as string[] };
      (window as any).verificationState = state;
      window.addEventListener("message", async (event) => {
        const frame = document.getElementById("candidate") as HTMLIFrameElement;
        const message = event.data;
        if (
          event.source !== frame.contentWindow ||
          event.origin !== "null" ||
          message?.nonce !== token ||
          message.channel !== "cd80"
        )
          return;
        if (message.log) {
          state.errors.push(String(message.log.message));
          return;
        }
        if (message.ready) {
          state.ready = true;
          return;
        }
        try {
          const result = await (window as any).verifyRpc(message);
          frame.contentWindow?.postMessage(
            { channel: "cd80-result", nonce: token, id: message.id, result },
            "*",
          );
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Verification RPC failed";
          state.errors.push(detail);
          frame.contentWindow?.postMessage(
            { channel: "cd80-result", nonce: token, id: message.id, error: detail },
            "*",
          );
        }
      });
    }, nonce);
    async function render() {
      await page.evaluate(
        (html) => {
          (window as any).verificationState.ready = false;
          (document.getElementById("candidate") as HTMLIFrameElement).srcdoc = html;
        },
        previewDocument(release.bundle, nonce),
      );
      await page.waitForFunction(() => (window as any).verificationState.ready);
      await page.waitForTimeout(150);
    }
    await render();
    const frame = page.frameLocator("#candidate");
    const visible = await frame.locator("body").innerText();
    if (!visible.trim()) throw new Error("App signalled ready but rendered no visible content");
    if (await frame.locator('[role="alert"]').filter({ hasText: /\S/ }).count())
      throw new Error("Application rendered an error alert");
    checks.push({
      name: "Browser rendering",
      passed: true,
      detail: "Production sandbox document signalled readiness and rendered visible content.",
    });
    const controls = await frame.locator("button,input,textarea,select").count();
    const tests = release.bundle.manifest.browserTests ?? [];
    if (controls && !tests.some((step) => step.action === "click"))
      throw new Error("Interactive UI needs manifest browserTests with a click and text assertion");
    if (controls && !tests.some((step) => step.action === "assert-text"))
      throw new Error("Interactive UI needs an observable text assertion");
    for (const step of tests) {
      const element = frame.locator(step.selector);
      if (step.action === "click") await element.click();
      else if (step.action === "fill") await element.fill(step.value);
      else await element.filter({ hasText: step.value }).waitFor();
    }
    await page.waitForTimeout(150);
    if (release.capabilityArtifact && !flows)
      throw new Error("Capability preview never executed its pinned flow");
    if (
      !release.capabilityArtifact &&
      release.bundle.manifest.permissions.includes("storage.write") &&
      !writes
    )
      throw new Error("Declared storage.write must be exercised by a browser test");
    if (writes) {
      const written = JSON.stringify(data);
      await render();
      if (!reads || written !== JSON.stringify(data))
        throw new Error("Save/reload verification failed");
    }
    if (latestResult) {
      const bindings = await frame.locator("[data-cd80-result]").evaluateAll((elements) =>
        elements.map((element) => ({
          key: element.getAttribute("data-cd80-result")!,
          value: element.textContent?.trim(),
          visible:
            !!(element.getBoundingClientRect().width && element.getBoundingClientRect().height) &&
            getComputedStyle(element).visibility !== "hidden",
        })),
      );
      if (!bindings.length)
        throw new Error(
          "Calculation UI needs visible data-cd80-result bindings for displayed values",
        );
      const expectedKeys =
        release.spec.protocol === "portfolio"
          ? ["totalValue", "profit", "returnPct", "concentrationPct"]
          : release.spec.protocol === "strategy"
            ? ["grossReturnPct", "netReturnPct", "maxDrawdownPct"]
            : ["missing"];
      if (expectedKeys.some((key) => !bindings.some((binding) => binding.key === key)))
        throw new Error(
          "Every required numeric protocol output must have an inspectable display binding",
        );
      for (const binding of bindings) {
        if (!binding.visible) throw new Error(`Calculation binding is not visible: ${binding.key}`);
        const value = (latestResult as Record<string, unknown>)[binding.key];
        const displayed = Number(binding.value?.replaceAll(",", "").replace(/[^0-9.+-]/g, ""));
        if (
          typeof value !== "number" ||
          !Number.isFinite(displayed) ||
          Math.abs(displayed - value) > 0.011
        )
          throw new Error(`Displayed calculation mismatch: ${binding.key}`);
      }
    }
    if (release.bundle.manifest.permissions.includes("plugin.call") && !pluginsUsed.size)
      throw new Error("Declared plugin integration must execute against an explicit fixture");
    errors.push(
      ...(await page.evaluate(() => (window as any).verificationState.errors as string[])),
    );
    if (errors.length) throw new Error(errors.join("; ").slice(0, 1000));
    checks.push({
      name: "Browser interaction and persistence",
      passed: true,
      detail: `${tests.length} declared steps passed; ${writes} isolated writes; reload and result bindings checked where applicable. Plugin results and AI use explicit fixtures, not live acceptance.`,
    });
  } catch (error) {
    checks.push({
      name: "Application browser verification",
      passed: false,
      detail: error instanceof Error ? error.message.slice(0, 1500) : "Browser verification failed",
    });
  } finally {
    clearTimeout(deadline);
    await browser?.close().catch(() => {});
    running = false;
  }
  return checks;
}
