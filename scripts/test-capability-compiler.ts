import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import ts from "typescript";
import { b2cPerformancePlan, type CapabilityPlan } from "../packages/capabilities/src";
import { simulationContractSchemas } from "../packages/capabilities/src/definitions";
import {
  generateCapabilityTypeScript,
  runCapabilityPlan,
} from "../packages/capabilities/src/runtime";
import { compileCapabilityProgram } from "../apps/web/src/server/capability-compiler";

const plan = structuredClone(b2cPerformancePlan);
const compiled = compileCapabilityProgram(plan);
assert.equal(compiled.typescript, generateCapabilityTypeScript(plan));
assert.equal(compiled.typescript, compileCapabilityProgram(plan).typescript);
assert.deepEqual(
  await compiled.run({ query: "Fixture query" }),
  await runCapabilityPlan(plan, { query: "Fixture query" }),
);
await assert.rejects(compiled.run({}), /Invalid/);
await assert.rejects(compiled.run({ query: 42 }), /Invalid/);
await assert.rejects(compiled.run({ query: "Fixture", unexpected: true }), /Unrecognized/);

// Mutating caller data or the returned artifact cannot alter the checked closure.
const expected = await compiled.run({ query: "Fixture" });
plan.steps[0]!.version = "999.0.0";
compiled.typescript = "throw new Error('untrusted artifact');";
assert.deepEqual(await compiled.run({ query: "Fixture" }), expected);
assert.throws(() => compileCapabilityProgram(plan), /non-executable/);
assert.throws(() => compileCapabilityProgram("process.exit()" as unknown as CapabilityPlan));

// Each registered contract is exercised, including contracts used only by outputs.
const values = {
  "simulation.text@1": "Fixture",
  "simulation.nine-answers@1": Array(9).fill("UNKNOWN"),
  "simulation.risk@1": "simulated-low",
  "simulation.industry@1": "Fictional industry",
  "simulation.items@1": ["Fictional item"],
  "simulation.metrics@1": { fixtureValue: 7, unit: "arbitrary-fixture-units" },
  "simulation.dashboard@1": simulationContractSchemas["simulation.dashboard@1"].parse({
    title: "Fixture",
    fixtureValue: 7,
    warning: (await compiled.run({ query: "Fixture" })).provenance.warning,
  }),
};
for (const [contract, value] of Object.entries(values)) {
  const outputOnly = structuredClone(b2cPerformancePlan);
  outputOnly.steps = [];
  outputOnly.coverage = outputOnly.requirements.map((requirement) => ({
    requirementId: requirement.id,
    status: "unsupported",
    stepIds: [],
    reason: "Only a prototype input echo, not product delivery.",
  }));
  outputOnly.outputs = { echo: { kind: "input", name: "value", contract } };
  assert.deepEqual((await compileCapabilityProgram(outputOnly).run({ value })).outputs.echo, value);
}

const literalPlan = structuredClone(b2cPerformancePlan);
literalPlan.steps[0]!.inputs.query = {
  kind: "literal",
  value: '"; globalThis.__capabilityCompilerInjected = true; require("node:fs"); //\n\u2028',
};
const literalCompiled = compileCapabilityProgram(literalPlan);
assert.deepEqual(await literalCompiled.run({}), await runCapabilityPlan(literalPlan, {}));
assert.equal(Reflect.get(globalThis, "__capabilityCompilerInjected"), undefined);
await assert.rejects(literalCompiled.run({ extra: true }), /Unrecognized/);

// Inject a semantic type mismatch through a library fixture, not caller source.
// Syntax-only transpilation would incorrectly accept the generated wrapper.
const readFile = ts.sys.readFile.bind(ts.sys);
ts.sys.readFile = (path, encoding) => {
  const source = readFile(path, encoding);
  return path.endsWith("/lib.es5.d.ts")
    ? source?.replace(
        "type Record<K extends keyof any, T> = {",
        "type Record<K extends keyof any, T> = never; type CompilerTestRecord<K extends keyof any, T> = {",
      )
    : source;
};
try {
  assert.throws(() => compileCapabilityProgram(b2cPerformancePlan), /TS2345/);
} finally {
  ts.sys.readFile = readFile;
}

// Resolution must work outside the checkout and without workspace source reads.
const cwd = process.cwd();
const defaultLibDirectory = ts.getDefaultLibFilePath({}).replace(/[^/\\]+$/, "");
ts.sys.readFile = (path, encoding) => {
  assert.ok(path.startsWith(defaultLibDirectory), `Unexpected compiler disk read: ${path}`);
  return readFile(path, encoding);
};
try {
  process.chdir(tmpdir());
  assert.deepEqual(
    await compileCapabilityProgram(b2cPerformancePlan).run({ query: "Fixture" }),
    expected,
  );
} finally {
  process.chdir(cwd);
  ts.sys.readFile = readFile;
}
console.log(
  "Capability compiler checks passed: strict compilation, wrapper execution, snapshots, contracts and path-independent resolution. No production release integration or live inference is asserted.",
);
