/// <reference lib="dom" />
// Static protected component only: no generated code, SSR, host server, or disk bundle.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

type Session = {
  session_id: string;
  ordered_company_ids: string[];
  round_index: number;
  exposed_company_ids: string[];
};
type DiscoveryReply = {
  status: string;
  session_state?: Session;
  ordered_company_ids?: string[];
  eligible_company_count?: number;
};
type DiscoveryCall = {
  capability: string;
  input: {
    action?: string;
    key?: string;
    value?: string[];
    excluded_company_ids?: string[];
    company_id?: string;
    choice?: string;
    session_state?: Session;
    risk_result?: { total_score: number; risk_profile_bucket: string };
    industry_preference?: { effective_industries: string[] };
  };
};
declare global {
  interface Window {
    companyDiscoverySeed?: Record<string, string[]>;
    companyDiscoveryTest: {
      storage: Record<string, string[]>;
      calls: DiscoveryCall[];
      results: DiscoveryReply[];
      companies: { ticker: string; name: string; size_category: string; industry: string }[];
      randomCalls: number;
      sessions: number;
      failRpc: boolean;
      failStorage: boolean;
      failRead: boolean;
      holdWrite: boolean;
      releaseWrite: (() => void) | null;
    };
  }
}

const starterSrc = fileURLToPath(new URL("../apps/web/starter/project/src/", import.meta.url));
const build = await Bun.build({
  entrypoints: [fileURLToPath(new URL("./fixtures/company-discovery-ui.js", import.meta.url))],
  target: "browser",
  format: "esm",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
  plugins: [
    {
      name: "starter-source-alias",
      setup(builder) {
        builder.onResolve(
          { filter: /^(react(?:\/.*)?|react-dom(?:\/.*)?|@tanstack\/react-query)$/ },
          ({ path }) => ({ path: Bun.resolveSync(path, starterSrc) }),
        );
        builder.onResolve({ filter: /^@\// }, ({ path }) => ({
          path: Bun.resolveSync(starterSrc + path.slice(2), starterSrc),
        }));
      },
    },
  ],
});
assert(build.success, build.logs.map(String).join("\n"));
assert.equal(build.outputs.length, 1, "Fixture must be a single in-memory browser bundle");
const bundle = await build.outputs[0]!.text();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  headless: true,
});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  let seed: Record<string, string[]> = {};
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    switch (url.origin + url.pathname) {
      case "https://discovery-test.local/":
        return route.fulfill({
          contentType: "text/html",
          body: `<!doctype html><html><head><title>Company discovery test</title></head><body><div id="root"></div><script>window.companyDiscoverySeed=${JSON.stringify(seed)};</script><script type="module" src="/fixture.js"></script></body></html>`,
        });
      case "https://discovery-test.local/fixture.js":
        return route.fulfill({ contentType: "text/javascript", body: bundle });
      default:
        throw new Error(`Unexpected browser request: ${route.request().url()}`);
    }
  });
  const start = page.getByRole("button", { name: "Start discovery", exact: true });
  const nextSession = page.getByRole("button", { name: "Start new session", exact: true });
  const add = page.getByRole("button", { name: "Add to watchlist", exact: true });
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  const failure = page.getByText("Discovery action could not be completed", { exact: true });
  const completed = page.getByRole("status").filter({ hasText: "Session completed." });
  const exhaustedText = "You have seen all matching companies. Come back later for new companies.";
  const ids = Array.from({ length: 6 }, (_, index) => `SSE:${600000 + index}`);
  async function snapshot() {
    return page.evaluate(() => {
      const state = window.companyDiscoveryTest;
      return {
        calls: state.calls,
        storage: state.storage,
        results: state.results,
        randomCalls: state.randomCalls,
        sessions: state.sessions,
      };
    });
  }
  function writes(state: Awaited<ReturnType<typeof snapshot>>) {
    return state.calls.filter((call) => call.capability === "storage.write");
  }
  function rpcs(state: Awaited<ReturnType<typeof snapshot>>) {
    return state.calls.filter((call) => call.capability === "finance.company-discovery.v1-3");
  }
  async function fresh(storage: Record<string, string[]> = {}) {
    seed = storage;
    await page.goto("https://discovery-test.local/");
    await page.waitForFunction(() => {
      const button = document.querySelector("button");
      return button && !button.disabled;
    });
    assert.equal(await start.isEnabled(), true);
    assert.deepEqual((await snapshot()).calls, [
      { capability: "storage.read", input: { key: "discovery-watchlist" } },
    ]);
    assert.equal(await add.count(), 0, "Discovery must not start automatically");
  }
  async function privateResult() {
    assert.doesNotMatch(
      await page.locator("body").innerText(),
      /\b(score|bucket|low|medium|high)\b/i,
    );
  }
  async function card(id: string, round: number, total = 5) {
    await page.getByText(`Company ${round} of ${total}`, { exact: true }).waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (button) => button.textContent === "Add to watchlist" && !button.disabled,
      ),
    );
    assert.equal(await add.count(), 1);
    assert.equal(await skip.count(), 1);
    assert.equal(await page.locator('[data-slot="card"]').count(), 1);
    const name = `Supplied company ${Number(id.slice(4)) - 600000 + 1}`;
    assert.deepEqual(await page.locator('[data-slot="card-title"]').allTextContents(), [name]);
    assert.equal(await add.isEnabled(), true);
    assert.equal(await skip.isEnabled(), true);
    await privateResult();
  }

  await fresh();
  await privateResult();
  await start.click();
  await card(ids[0]!, 1);
  const initial = await snapshot();
  assert.deepEqual(initial.results[0]?.ordered_company_ids, ids.slice(0, 5));
  assert.equal(initial.results[0]?.eligible_company_count, 6);
  assert.equal(initial.randomCalls, 5);
  assert.equal(writes(initial).length, 0);
  assert.equal(rpcs(initial)[0]?.input.risk_result?.risk_profile_bucket, "low");
  assert.equal(rpcs(initial)[0]?.input.risk_result?.total_score, 7);
  assert.deepEqual(rpcs(initial)[0]?.input.industry_preference?.effective_industries, [
    "manufacturing",
  ]);

  await page.evaluate(() => {
    window.companyDiscoveryTest.holdWrite = true;
  });
  // Two click events in one browser task exercise the synchronous in-flight guard.
  await add.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await page.waitForFunction(() => window.companyDiscoveryTest.releaseWrite !== null);
  const pending = await snapshot();
  assert.equal(writes(pending).length, 1, "Double-click Add must issue exactly one write");
  assert.equal(rpcs(pending).length, 2, "Double-click must consume only one round");
  assert.deepEqual(pending.storage, {});
  assert.equal(await page.getByText("Company 1 of 5", { exact: true }).count(), 1);
  assert.equal(await page.getByText("No saved companies yet.", { exact: true }).count(), 1);
  assert.equal(await add.isDisabled(), true);
  await page.evaluate(() => {
    window.companyDiscoveryTest.holdWrite = false;
    window.companyDiscoveryTest.releaseWrite?.();
  });
  await card(ids[1]!, 2);
  assert.deepEqual((await snapshot()).storage, { "discovery-watchlist": [ids[0]] });
  assert.deepEqual(await page.getByRole("listitem").allTextContents(), [ids[0]]);
  for (let round = 2; round <= 5; round++) {
    await card(ids[round - 1]!, round);
    await skip.click();
    if (round < 5) await card(ids[round]!, round + 1);
  }
  await completed.waitFor();
  const finished = await snapshot();
  assert.equal(await add.count(), 0);
  assert.equal(await page.locator('[data-slot="card"]').count(), 0);
  assert.equal(writes(finished).length, 1, "Skips must never write storage");
  assert.equal(rpcs(finished).length, 6, "Six eligible companies still yield only five rounds");
  assert.equal(finished.randomCalls, 5, "Advancing must not reshuffle");
  for (const [index, call] of rpcs(finished).slice(1).entries()) {
    assert.deepEqual(call.input.session_state?.ordered_company_ids, ids.slice(0, 5));
    assert.equal(call.input.session_state?.round_index, index);
    assert.equal(call.input.company_id, ids[index]);
    assert.equal("choice" in call.input, false, "App-owned Add/Skip must use neutral RPC advances");
    assert.equal("watchlist_add" in finished.results[index + 1]!, false);
  }
  await privateResult();
  await nextSession.click();
  await card(ids[1]!, 1);
  const later = await snapshot();
  assert.deepEqual(later.results.at(-1)?.ordered_company_ids, ids.slice(1));
  assert.deepEqual(rpcs(later).at(-1)?.input.excluded_company_ids, [ids[0]]);
  assert.equal(later.sessions, 2);
  assert.notEqual(
    later.results.at(-1)?.session_state?.session_id,
    initial.results[0]?.session_state?.session_id,
  );

  await skip.click();
  await card(ids[2]!, 2);
  seed = (await snapshot()).storage;
  await page.reload();
  await start.waitFor();
  await page.waitForFunction(() => document.querySelector("button")?.disabled === false);
  assert.equal(await add.count(), 0, "Refresh must abandon the active session");
  assert.deepEqual(await page.getByRole("listitem").allTextContents(), [ids[0]]);
  const refreshed = await snapshot();
  assert.deepEqual(refreshed.storage, seed, "Saved watchlist survives a real browser reload");
  assert.equal(rpcs(refreshed).length, 0, "Refresh must not resume discovery automatically");
  assert.equal(writes(refreshed).length, 0);
  await start.click();
  await card(ids[1]!, 1);

  for (const mode of ["failRpc", "failStorage"] as const) {
    await fresh();
    await start.click();
    await card(ids[0]!, 1);
    await page.evaluate((key) => {
      window.companyDiscoveryTest[key] = true;
    }, mode);
    await add.click();
    await failure.waitFor();
    await card(ids[0]!, 1);
    const failed = await snapshot();
    assert.deepEqual(failed.storage, {});
    assert.equal(await page.getByRole("listitem").count(), 0, "Failure must not claim a save");
    assert.equal(writes(failed).length, mode === "failStorage" ? 1 : 0);
    await page.evaluate((key) => {
      window.companyDiscoveryTest[key] = false;
    }, mode);
    await add.click();
    await card(ids[1]!, 2);
    assert.equal(await failure.count(), 0);
    const retried = await snapshot();
    assert.deepEqual(retried.storage, { "discovery-watchlist": [ids[0]] });
    assert.deepEqual(await page.getByRole("listitem").allTextContents(), [ids[0]]);
    assert.deepEqual(rpcs(retried)[1]?.input, rpcs(retried)[2]?.input, "Retry uses the same round");
    assert.equal(retried.randomCalls, 5);
  }

  await fresh();
  await page.evaluate(() => {
    window.companyDiscoveryTest.failRead = true;
  });
  await start.click();
  await failure.waitFor();
  assert.equal(rpcs(await snapshot()).length, 0, "Failed canonical read must prevent RPC");
  await page.evaluate(() => {
    window.companyDiscoveryTest.failRead = false;
  });
  await start.click();
  await card(ids[0]!, 1);

  for (const mode of ["saved", "empty", "wrong-size", "wrong-industry"] as const) {
    await fresh(mode === "saved" ? { "discovery-watchlist": ids } : {});
    await page.evaluate((poolMode) => {
      const state = window.companyDiscoveryTest;
      if (poolMode === "empty") state.companies = [];
      if (poolMode === "wrong-size") {
        for (const company of state.companies) company.size_category = "Mid cap";
      }
      if (poolMode === "wrong-industry") {
        for (const company of state.companies) company.industry = "\u91d1\u878d\u4e1a";
      }
    }, mode);
    await start.click();
    await page.getByRole("status").filter({ hasText: exhaustedText }).waitFor();
    await page
      .getByText("Completing discovery action...", { exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("status").innerText(), exhaustedText);
    assert.equal(await add.count(), 0);
    assert.equal(await skip.count(), 0);
    assert.equal(await page.locator('[data-slot="card"]').count(), 0);
    const exhausted = await snapshot();
    assert.equal(exhausted.results[0]?.status, "exhausted");
    assert.equal(rpcs(exhausted).length, 1, "No automatic relaxed or fallback request");
    assert.equal(writes(exhausted).length, 0);
    assert.equal(exhausted.randomCalls, 0);
    await privateResult();
    await nextSession.click();
    await page.waitForFunction(() => window.companyDiscoveryTest.results.length === 2);
    await page.getByRole("status").filter({ hasText: exhaustedText }).waitFor();
    await page
      .getByText("Completing discovery action...", { exact: true })
      .waitFor({ state: "hidden" });
    const again = await snapshot();
    assert.deepEqual(
      rpcs(again)[0]?.input,
      rpcs(again)[1]?.input,
      "New session must not relax filters",
    );
    assert.equal(again.results[1]?.status, "exhausted");
    assert.equal(writes(again).length, 0);
  }
  seed = { "discovery-watchlist": ids };
  await page.goto("https://discovery-test.local/?default");
  await start.waitFor();
  assert.equal(await start.isEnabled(), true);
  assert.deepEqual((await snapshot()).calls, [], "Default discovery must not read saved state");
  assert.equal(await page.getByText("Saved watchlist", { exact: true }).count(), 0);
  await start.click();
  const next = page.getByRole("button", { name: "Next company", exact: true });
  for (let round = 1; round <= 5; round++) {
    await page.getByText(`Company ${round} of 5`, { exact: true }).waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (button) => button.textContent === "Next company" && !button.disabled,
      ),
    );
    assert.equal(await add.count(), 0);
    assert.equal(await skip.count(), 0);
    assert.equal(await page.locator('[data-slot="card"]').count(), 1);
    await privateResult();
    await next.click();
  }
  await completed.waitFor();
  const neutral = await snapshot();
  assert.equal(neutral.calls.length, 6);
  assert.equal(rpcs(neutral).length, 6, "Default discovery only calls the neutral RPC");
  assert.equal("excluded_company_ids" in rpcs(neutral)[0]!.input, false);
  assert(neutral.calls.every((call) => !("choice" in call.input) && !("watchlist" in call.input)));
  assert(neutral.results.every((result) => !("watchlist_add" in result)));
  assert.deepEqual(neutral.storage, seed, "Default discovery must not touch app-owned storage");
  await nextSession.click();
  await page.getByText("Company 1 of 5", { exact: true }).waitFor();
  assert.equal(
    (await snapshot()).calls.some((call) => call.capability.startsWith("storage.")),
    false,
  );
  assert.deepEqual(errors, [], "No uncaught browser errors");
  console.log(
    "PASS CompanyDiscovery browser: default neutral Next flow has no watchlist or storage calls; optional app watchlist retains one card, five-round cap, double-click Add, durable saves, write-free skips, fixed order, exclusions, retries, reload/session abandonment, exact exhaustion and private risk results.",
  );
} finally {
  await browser.close();
}
