/// <reference lib="dom" />
// Static protected component only: no generated code, SSR, host server, or disk bundle.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { RiskProfileCompleted } from "../apps/web/starter/project/src/lib/risk-profile";

export type QuestionnaireTestState = {
  storage: Map<string, RiskProfileCompleted>;
  calls: { capability: string; input: unknown }[];
  completions: RiskProfileCompleted[];
  resultMode: "valid" | "invalid" | "rejected";
  failStorage: boolean;
};

declare global {
  interface Window {
    riskQuestionnaireTest: QuestionnaireTestState;
  }
}

const starterSrc = fileURLToPath(new URL("../apps/web/starter/project/src/", import.meta.url));
const build = await Bun.build({
  entrypoints: [fileURLToPath(new URL("./fixtures/risk-questionnaire-ui.js", import.meta.url))],
  target: "browser",
  format: "esm",
  // Without outdir, Bun returns the bundle in memory rather than writing it to disk.
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
  plugins: [
    {
      name: "starter-source-alias",
      setup(builder) {
        builder.onResolve(
          { filter: /^(react(?:\/.*)?|react-dom(?:\/.*)?|@tanstack\/react-query)$/ },
          ({ path }) => ({
            path: Bun.resolveSync(path, starterSrc),
          }),
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
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    switch (route.request().url()) {
      case "https://risk-test.local/":
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html><head><title>Risk questionnaire test</title></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>',
        });
      case "https://risk-test.local/fixture.js":
        return route.fulfill({ contentType: "text/javascript", body: bundle });
      default:
        throw new Error(`Unexpected browser request: ${route.request().url()}`);
    }
  });
  const submit = page.getByRole("button", { name: "Complete questionnaire", exact: true });
  const success = page.getByRole("status").filter({ hasText: "Questionnaire completed." });
  const alert = page.getByText("Questionnaire could not be completed", { exact: true });
  const prompts = [
    "How comfortable are you with the value of an investment moving up and down over time?",
    "Imagine you invest RMB 10,000 and its value falls to RMB 8,000 for a time. What would you most likely do?",
    "What temporary fall in the value of your investments could you tolerate without changing your plan?",
    "Which investment trade-off feels closest to you?",
    "When might you need to use the money you are considering investing?",
    "If your income stopped, how long could your savings cover essential expenses?",
    "What return do you expect your investment portfolio to achieve over the next year?",
  ];
  const answers = [3, 2, 3, 2, 1, 2, 2];
  const expectedInput = {
    questionnaire_version: "v0-demo",
    answers: { q1: 3, q2: 2, q3: 3, q4: 2, q5: 1, q6: 2, q7: 2 },
  };
  const expectedCompletion = {
    status: "completed",
    ...expectedInput,
    total_score: 15,
    risk_profile_bucket: "medium",
  };
  async function snapshot() {
    return page.evaluate(() => {
      const state = window.riskQuestionnaireTest;
      return {
        calls: state.calls,
        storage: [...state.storage.entries()],
        completions: state.completions,
      };
    });
  }
  async function fresh() {
    await page.goto("https://risk-test.local/");
    await submit.waitFor();
    assert.deepEqual(await snapshot(), {
      calls: [{ capability: "storage.read", input: { key: "risk-profile" } }],
      storage: [],
      completions: [],
    });
  }
  async function assertPrivateResult() {
    assert.doesNotMatch(await page.locator("body").innerText(), /\b(score|bucket|15)\b/i);
    if (await success.count()) {
      assert.doesNotMatch(await page.locator("body").innerText(), /\b(low|medium|high)\b/i);
    }
  }
  async function fill() {
    for (const [index, answer] of answers.entries()) {
      await page
        .locator(`input[name="q${index + 1}"]`)
        .nth(answer - 1)
        .check();
      await assertPrivateResult();
    }
    assert.equal(await submit.isEnabled(), true);
  }

  await fresh();
  assert.equal(await page.getByRole("radio").count(), 21);
  assert.equal(await page.locator("fieldset").count(), 7);
  for (const prompt of prompts) {
    const group = page.getByRole("group", { name: prompt, exact: true });
    assert.equal(await group.count(), 1, prompt);
    assert.equal(await group.getByRole("radio").count(), 3);
    for (const label of ["Low", "Medium", "High"]) {
      assert.equal(await group.getByRole("radio", { name: new RegExp(`^${label}:`) }).count(), 1);
    }
  }
  assert.equal(await page.locator("input:checked").count(), 0);
  assert.equal(await submit.isDisabled(), true);
  for (const choice of ["Low", "Medium", "High"]) {
    await page.locator(`input[name="q1"][value="${choice}"]`).check();
    assert.equal(await page.locator('input[name="q1"]:checked').count(), 1);
    assert.equal(await page.locator("input:checked").inputValue(), choice);
    assert.equal(await submit.isDisabled(), true);
  }
  for (let index = 1; index < 6; index++) {
    await page
      .locator(`input[name="q${index + 1}"]`)
      .nth(answers[index]! - 1)
      .check();
    assert.equal(await submit.isDisabled(), true, "All seven answers are required");
  }
  assert.equal(
    (await snapshot()).calls.length,
    1,
    "Partial answers never call finance or storage.write",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await page.locator("input:checked").count(), 0);
  assert.equal(await submit.isDisabled(), true);
  assert.equal((await snapshot()).calls.length, 1);
  await page.locator('input[name="q1"]').first().check();
  await page.reload();
  await submit.waitFor();
  assert.equal(await page.locator("input:checked").count(), 0);
  assert.equal(await submit.isDisabled(), true);
  assert.deepEqual((await snapshot()).storage, []);
  assert.equal((await snapshot()).calls.length, 1);

  await fill();
  assert.equal((await snapshot()).calls.length, 1, "Even a complete draft must not persist");
  await submit.click();
  await success.waitFor();
  assert.deepEqual(await snapshot(), {
    calls: [
      { capability: "storage.read", input: { key: "risk-profile" } },
      { capability: "finance.risk-profile", input: expectedInput },
      { capability: "storage.write", input: { key: "risk-profile", value: expectedCompletion } },
    ],
    storage: [["risk-profile", expectedCompletion]],
    completions: [expectedCompletion],
  });
  await assertPrivateResult();
  const completedSnapshot = await snapshot();
  await page.getByRole("button", { name: "Retake questionnaire", exact: true }).click();
  assert.equal(await page.locator("input:checked").count(), 0);
  await page.locator('input[name="q1"]').first().check();
  assert.equal(await submit.isDisabled(), true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await success.waitFor();
  assert.deepEqual(
    await snapshot(),
    completedSnapshot,
    "Canceled retake preserves saved completion",
  );
  await assertPrivateResult();
  await page.getByRole("button", { name: "Retake questionnaire", exact: true }).click();
  assert.equal(await page.locator("input:checked").count(), 0);

  for (const mode of ["invalid", "rejected"] satisfies QuestionnaireTestState["resultMode"][]) {
    await fresh();
    await page.evaluate((resultMode) => {
      window.riskQuestionnaireTest.resultMode = resultMode;
    }, mode);
    await fill();
    await submit.click();
    await alert.waitFor();
    assert.equal(await success.count(), 0);
    assert.equal(await submit.isEnabled(), true);
    const failed = await snapshot();
    assert.deepEqual(failed.storage, []);
    assert.deepEqual(failed.completions, []);
    assert.deepEqual(
      failed.calls.map((call) => call.capability),
      ["storage.read", "finance.risk-profile"],
    );
    await assertPrivateResult();
    await page.evaluate(() => {
      window.riskQuestionnaireTest.resultMode = "valid";
    });
    await submit.click();
    await success.waitFor();
    const retried = await snapshot();
    assert.deepEqual(retried.storage, [["risk-profile", expectedCompletion]]);
    assert.deepEqual(retried.completions, [expectedCompletion]);
    assert.deepEqual(
      retried.calls.map((call) => call.capability),
      ["storage.read", "finance.risk-profile", "finance.risk-profile", "storage.write"],
    );
    await assertPrivateResult();
  }

  await fresh();
  await page.evaluate(() => {
    window.riskQuestionnaireTest.failStorage = true;
  });
  await fill();
  await submit.click();
  await alert.waitFor();
  assert.equal(await success.count(), 0);
  assert.equal(
    await page.getByRole("button", { name: "Retake questionnaire", exact: true }).count(),
    0,
  );
  const failedSave = await snapshot();
  assert.deepEqual(failedSave.storage, []);
  assert.deepEqual(failedSave.completions, []);
  assert.deepEqual(
    failedSave.calls.map((call) => call.capability),
    ["storage.read", "finance.risk-profile", "storage.write"],
  );
  await assertPrivateResult();
  await page.evaluate(() => {
    window.riskQuestionnaireTest.failStorage = false;
  });
  await submit.click();
  await success.waitFor();
  assert.deepEqual((await snapshot()).storage, [["risk-profile", expectedCompletion]]);
  assert.deepEqual((await snapshot()).completions, [expectedCompletion]);
  await assertPrivateResult();
  assert.deepEqual(errors, [], "No uncaught browser errors");
  console.log(
    "PASS RiskQuestionnaire browser: seven exact prompts, 21 radios, required answers, exclusive choices, draft/cancel/reload, score-15 medium persistence, private result, retake, invalid/rejected bridge retry, and failed-save retry.",
  );
} finally {
  await browser.close();
}
