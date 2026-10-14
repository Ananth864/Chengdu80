/// <reference lib="dom" />
// Static protected component only: no generated code, SSR, host server, or disk bundle.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { z } from "zod";
import type { normalizedIndustryPreferenceSchema } from "../apps/web/starter/project/src/lib/company-discovery";

type Preference = z.infer<typeof normalizedIndustryPreferenceSchema>;
declare global {
  interface Window {
    __industryPreferenceSeed?: Record<string, Preference>;
    industryPreferenceTest: {
      storage: Map<string, Preference>;
      calls: { capability: string; input: unknown }[];
      completions: Preference[];
      resultMode: "valid" | "invalid" | "rejected" | "transport-error";
      failStorage: boolean;
    };
  }
}

const starterSrc = fileURLToPath(new URL("../apps/web/starter/project/src/", import.meta.url));
const build = await Bun.build({
  entrypoints: [fileURLToPath(new URL("./fixtures/industry-preference-ui.js", import.meta.url))],
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
  let seed: Record<string, Preference> = {};
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    switch (route.request().url()) {
      case "https://industry-test.local/":
        return route.fulfill({
          contentType: "text/html",
          // Base UI checkboxes need a click target without the production Tailwind stylesheet.
          body: `<!doctype html><html><head><title>Industry preference test</title><style>[data-slot="checkbox"]{display:inline-block;width:16px;height:16px}</style></head><body><div id="root"></div><script>window.__industryPreferenceSeed=${JSON.stringify(seed)};</script><script type="module" src="/fixture.js"></script></body></html>`,
        });
      case "https://industry-test.local/fixture.js":
        return route.fulfill({ contentType: "text/javascript", body: bundle });
      default:
        throw new Error(`Unexpected browser request: ${route.request().url()}`);
    }
  });
  const industries = [
    { id: "manufacturing", label: "Manufacturing" },
    { id: "information_software_it", label: "Information transmission, software and IT services" },
    { id: "utilities", label: "Electricity, heat, gas and water production and supply" },
    { id: "financial_services", label: "Financial services" },
    { id: "wholesale_retail", label: "Wholesale and retail" },
  ] as const;
  const ids = industries.map(({ id }) => id);
  const labels = industries.map(({ label }) => label);
  const save = page.getByRole("button", { name: "Save industry preferences", exact: true });
  const edit = page.getByRole("button", { name: "Edit preferences", exact: true });
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });
  const success = page.getByRole("status").filter({ hasText: "Industry preferences saved." });
  const failure = page.getByText("Industry preferences could not be saved", { exact: true });
  const checkbox = (label: string) => page.getByRole("checkbox", { name: label, exact: true });
  const read = { capability: "storage.read", input: { key: "industry-preference" } };
  const request = (selected: Preference["selected_industries"]) => ({
    capability: "finance.industry-preferences",
    input: { operation: "capture_preferences", selected_industries: selected },
  });
  const write = (preference: Preference) => ({
    capability: "storage.write",
    input: { key: "industry-preference", value: preference },
  });
  async function snapshot() {
    const state = await page.evaluate(() => {
      const state = window.industryPreferenceTest;
      return {
        calls: state.calls,
        storage: [...state.storage.entries()],
        completions: state.completions,
      };
    });
    for (const call of state.calls) {
      assert.ok(
        ["storage.read", "storage.write", "finance.industry-preferences"].includes(call.capability),
        `No risk scoring, data, catalog or other capability calls: ${call.capability}`,
      );
      if (call.capability.startsWith("storage.")) {
        assert.equal((call.input as { key: string }).key, "industry-preference");
      }
    }
    return state;
  }
  async function checked(selected: readonly string[]) {
    assert.equal(await page.getByRole("checkbox").count(), 5);
    for (const { id, label } of industries) {
      assert.equal(await checkbox(label).isChecked(), selected.includes(id), label);
    }
  }
  async function fresh() {
    seed = {};
    await page.goto("https://industry-test.local/");
    await save.waitFor();
    assert.equal(await save.isEnabled(), true);
    await checked([]);
    assert.deepEqual(await snapshot(), { calls: [read], storage: [], completions: [] });
  }
  async function saved(preference: Preference, expectedLabels: readonly string[]) {
    await success.waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (button) => button.textContent === "Edit preferences" && !button.disabled,
      ),
    );
    assert.equal(await edit.isEnabled(), true);
    assert.equal(await save.count(), 0);
    assert.equal(await page.getByRole("checkbox").count(), 0);
    assert.deepEqual(await page.getByRole("listitem").allTextContents(), expectedLabels);
    assert.deepEqual((await snapshot()).storage, [["industry-preference", preference]]);
  }

  await fresh();
  for (const { label } of industries) {
    await checkbox(label).check();
    assert.deepEqual((await snapshot()).calls, [read], "Checkbox clicks must not call or persist");
  }
  await checked(ids);
  await cancel.click();
  await checked([]);
  assert.deepEqual(await snapshot(), { calls: [read], storage: [], completions: [] });
  await checkbox(labels[0]!).check();
  await page.reload();
  await save.waitFor();
  await checked([]);
  assert.deepEqual(await snapshot(), { calls: [read], storage: [], completions: [] });

  const allSupported: Preference = {
    selection_mode: "all_supported",
    selected_industries: [],
    effective_industries: ids,
  };
  await save.click();
  await saved(allSupported, labels);
  assert.equal(
    await page
      .getByText("No industries selected: all five supported industries are allowed.", {
        exact: true,
      })
      .count(),
    1,
  );
  assert.deepEqual(await snapshot(), {
    calls: [read, request([]), write(allSupported)],
    storage: [["industry-preference", allSupported]],
    completions: [allSupported],
  });
  await edit.click();
  await checked([]);
  for (const { label } of industries) await checkbox(label).check();
  assert.equal((await snapshot()).calls.length, 3);
  const allSelected: Preference = {
    selection_mode: "selected",
    selected_industries: ids,
    effective_industries: ids,
  };
  await save.click();
  await saved(allSelected, labels);
  assert.deepEqual((await snapshot()).calls.slice(-2), [request(ids), write(allSelected)]);
  assert.deepEqual((await snapshot()).completions, [allSupported, allSelected]);
  await edit.click();
  await checked(ids);
  await cancel.click();
  await saved(allSelected, labels);

  await fresh();
  const selected: Preference["selected_industries"] = [
    "financial_services",
    "information_software_it",
  ];
  const selectedLabels = [labels[3]!, labels[1]!];
  for (const label of selectedLabels) await checkbox(label).check();
  assert.deepEqual((await snapshot()).calls, [read]);
  const preference: Preference = {
    selection_mode: "selected",
    selected_industries: selected,
    effective_industries: selected,
  };
  await save.click();
  await saved(preference, selectedLabels);
  assert.deepEqual(await snapshot(), {
    calls: [read, request(selected), write(preference)],
    storage: [["industry-preference", preference]],
    completions: [preference],
  });
  seed = Object.fromEntries((await snapshot()).storage);
  await page.reload();
  await saved(preference, selectedLabels);
  const reloaded = await snapshot();
  assert.deepEqual(reloaded, {
    calls: [read],
    storage: [["industry-preference", preference]],
    completions: [],
  });
  await edit.click();
  await checked(selected);
  await checkbox(labels[3]!).uncheck();
  await checkbox(labels[0]!).check();
  await cancel.click();
  await saved(preference, selectedLabels);
  assert.deepEqual(
    await snapshot(),
    reloaded,
    "Canceled edit must retain the previous save without writes",
  );
  await edit.click();
  await checked(selected);
  await checkbox(labels[0]!).check();
  const draft = [...selected, "manufacturing"] satisfies Preference["selected_industries"];
  const updated: Preference = {
    selection_mode: "selected",
    selected_industries: draft,
    effective_industries: draft,
  };
  await page.evaluate(() => {
    window.industryPreferenceTest.failStorage = true;
  });
  await save.click();
  await failure.waitFor();
  await checked(draft);
  assert.equal(await success.count(), 0);
  assert.equal(await edit.count(), 0);
  assert.equal(await save.isEnabled(), true);
  assert.deepEqual(await snapshot(), {
    calls: [read, request(draft), write(updated)],
    storage: [["industry-preference", preference]],
    completions: [],
  });
  await page.evaluate(() => {
    window.industryPreferenceTest.failStorage = false;
  });
  await save.click();
  await saved(updated, [...selectedLabels, labels[0]!]);
  assert.equal(await failure.count(), 0);
  assert.deepEqual(await snapshot(), {
    calls: [read, request(draft), write(updated), request(draft), write(updated)],
    storage: [["industry-preference", updated]],
    completions: [updated],
  });

  for (const mode of ["invalid", "rejected", "transport-error"] as const) {
    await fresh();
    for (const label of selectedLabels) await checkbox(label).check();
    await page.evaluate((mode) => {
      window.industryPreferenceTest.resultMode = mode;
    }, mode);
    await save.click();
    await failure.waitFor();
    await checked(selected);
    assert.equal(await success.count(), 0);
    assert.equal(await edit.count(), 0);
    assert.equal(await save.isEnabled(), true);
    assert.deepEqual(
      await snapshot(),
      {
        calls: [read, request(selected)],
        storage: [],
        completions: [],
      },
      `${mode} must not persist or report success`,
    );
    await page.evaluate(() => {
      window.industryPreferenceTest.resultMode = "valid";
    });
    await save.click();
    await saved(preference, selectedLabels);
    assert.equal(await failure.count(), 0);
    assert.deepEqual(await snapshot(), {
      calls: [read, request(selected), request(selected), write(preference)],
      storage: [["industry-preference", preference]],
      completions: [preference],
    });
  }
  assert.deepEqual(errors, [], "No uncaught browser errors");
  console.log(
    "PASS IndustryPreference browser: five unchecked defaults, explicit-only saves, all-supported versus all-selected intent, canonical IDs, reload labels, initialized edits, write-free Cancel, retained drafts and retry after storage/invalid/rejected/transport failures, and no risk/data/catalog calls.",
  );
} finally {
  await browser.close();
}
