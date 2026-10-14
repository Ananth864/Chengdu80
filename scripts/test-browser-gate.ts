import assert from "node:assert/strict";
import { protocols, type Application } from "../apps/web/src/lib/contracts";
import { sampleBundle } from "../apps/web/src/lib/samples";
import { defaultData, fixtureMeta } from "../apps/web/src/lib/finance";
import { makeRelease, applyRelease } from "../apps/web/src/server/platform";
import { disposeRuntimes } from "../apps/web/src/server/runtime";

const spec = protocols[0]!.defaultSpec;
const app: Application = {
  id: "browser-gate",
  ownerId: "fixture",
  revision: 0,
  name: spec.name,
  spec,
  current: null,
  preview: null,
  data: { inputs: defaultData(spec.protocol), _provenance: fixtureMeta },
  events: [],
  history: [],
  createdAt: new Date().toISOString(),
};
try {
  const good = await makeRelease(spec, sampleBundle(spec), "sample", "Browser fixture");
  assert.equal(await applyRelease(app, good), true, JSON.stringify(good.verification.checks));
  assert(good.verification.application);
  const before = JSON.stringify(app.data);
  const current = app.current!.id;
  for (const [name, change] of [
    [
      "runtime error",
      (bundle: ReturnType<typeof sampleBundle>) => {
        bundle.files["app.js"] = "throw new Error('Broken DOM');";
      },
    ],
    [
      "false readiness",
      (bundle: ReturnType<typeof sampleBundle>) => {
        bundle.files["index.html"] = "<main id='app'></main>";
        bundle.files["app.js"] = "cd80.ready();";
      },
    ],
    [
      "wrong displayed value",
      (bundle: ReturnType<typeof sampleBundle>) => {
        bundle.files["app.js"] = bundle.files["app.js"].replace(
          "fmt(result.totalValue)",
          "fmt(result.totalValue+100)",
        );
      },
    ],
    [
      "missing save test",
      (bundle: ReturnType<typeof sampleBundle>) => {
        bundle.manifest.browserTests = [];
      },
    ],
  ] as const) {
    const bundle = sampleBundle(spec);
    change(bundle);
    const bad = await makeRelease(spec, bundle, "import", name);
    assert.equal(bad.verification.passed, true, "Source/calculation fixture must pass first");
    assert.equal(await applyRelease(app, bad), false, name);
    assert.equal(app.current!.id, current);
    assert.equal(JSON.stringify(app.data), before);
    console.log(`PASS Browser gate rejects ${name} and preserves active source/data`);
  }
  const incompatible = await makeRelease(spec, sampleBundle(spec), "sample", "Saved input check");
  const invalidApp = { ...app, data: { inputs: { holdings: [], cash: -1 } } };
  assert.equal(await applyRelease(invalidApp, incompatible), false);
  console.log("PASS Saved input incompatibility blocks activation");
  console.log(
    "6 browser release checks passed; isolated UI writes never touched persistent storage.",
  );
} finally {
  await disposeRuntimes();
}
