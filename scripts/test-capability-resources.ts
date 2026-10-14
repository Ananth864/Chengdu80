import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  finmatchDefinitions,
  finmatchIndustries,
  finmatchQuestionnaire,
  mapRiskToIndustries,
  scoreRiskQuestionnaire,
} from "../packages/capabilities/src/finmatch";

export function main() {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const sourceRoot = "capability-resources/capability_library/";
  const catalog = JSON.parse(read("capability-resources/capability-library.json")) as {
    format: string;
    version: string;
    source_authority: string;
    product_documents: string[];
    capabilities: {
      id: string;
      matching_guidance: string;
      source_documents: string[];
      inputs: string[];
      specifications: string[];
      outputs: string[];
      asset_scope: string[];
    }[];
  };
  assert.equal(catalog.format, "capability-library-catalog");
  assert.equal(catalog.version, "0.2");
  assert.deepEqual(
    catalog.capabilities.map(({ id }) => id).sort(),
    finmatchDefinitions.map(({ id }) => id).sort(),
  );
  assert.deepEqual(catalog.product_documents, [
    `${sourceRoot}finmatch-application-2-product-decisions.md`,
  ]);
  for (const path of catalog.product_documents) assert.ok(read(path).trim());
  assert.match(catalog.source_authority, /Markdown.*authoritative/);
  for (const entry of catalog.capabilities) {
    const definition = finmatchDefinitions.find(({ id }) => id === entry.id)!;
    assert.deepEqual(entry.source_documents, definition.sourceDocuments);
    for (const path of entry.source_documents) {
      assert.ok(path.startsWith(sourceRoot) && path.endsWith(".md"));
      assert.ok(!catalog.product_documents.includes(path));
      assert.ok(read(path).trim(), `Empty source for ${entry.id}: ${path}`);
    }
    assert.ok(entry.matching_guidance.trim());
    for (const field of ["inputs", "specifications", "outputs", "asset_scope"] as const) {
      assert.ok(entry[field].length > 0);
      assert.ok(entry[field].every((text) => typeof text === "string" && text.trim()));
    }
  }
  const riskEntry = catalog.capabilities.find(({ id }) => id === "CAP-002")!;
  for (const field of ["questionnaire_version", "answers", "total_score", "risk_profile_bucket"]) {
    assert.ok(riskEntry.outputs[0]!.includes(field), `Missing catalog risk output: ${field}`);
  }
  assert.match(riskEntry.outputs[0]!, /internal application-facing/);

  const scoring = read(`${sourceRoot}finmatch-risk-questionnaire-scoring.md`);
  const questions = [
    ...scoring.matchAll(
      /^### (\d+)\. ([^\n]+)\n\n\*\*([^\n]+)\*\*\n([\s\S]*?)(?=\n### |\n## |(?![\s\S]))/gm,
    ),
  ].map(([, number, title, question, body]) => ({
    id: `q${number}`,
    title,
    question,
    choices: [...body!.matchAll(/^- \*\*(Low|Medium|High) \(([123])\):\*\* ([^\n]+)$/gm)].map(
      ([, label, score, text]) => ({ label, score: Number(score), text }),
    ),
  }));
  assert.equal(questions.length, 7, "Source must contain all seven questions");
  assert.equal(questions.flatMap(({ choices }) => choices).length, 21);
  for (const question of questions) assert.equal(question.choices.length, 3);
  assert.deepEqual(finmatchQuestionnaire, questions, "Exact question and choice copy drifted");

  // Fixed expectations catch coordinated source/runtime drift, not just agreement.
  const expectedBands = [
    { min: 7, max: 11, bucket: "low" },
    { min: 12, max: 16, bucket: "medium" },
    { min: 17, max: 21, bucket: "high" },
  ];
  const mapping = read(`${sourceRoot}finmatch-risk-to-industry-mapping-capability.md`);
  for (const source of [scoring, mapping]) {
    const bands = [...source.matchAll(/^\| (\d+)\u2013(\d+) \| `?(Low|Medium|High)`? \|$/gim)].map(
      ([, min, max, bucket]) => ({
        min: Number(min),
        max: Number(max),
        bucket: bucket!.toLowerCase(),
      }),
    );
    assert.deepEqual(bands, expectedBands, "Documented score cutoff table drifted");
  }
  const expectedIndustries = [
    ["technology", "Technology"],
    ["finance", "Finance"],
    ["agriculture", "Agriculture"],
    ["manufacturing", "Manufacturing"],
    ["fmcg", "FMCG"],
    ["energy", "Energy"],
  ];
  const preference = read(`${sourceRoot}finmatch-industry-preference-capability.md`);
  const industries = [...preference.matchAll(/^\| `([^`]+)` \| ([^|]+) \|$/gm)].map(
    ([, value, label]) => [value, label],
  );
  assert.deepEqual(industries, expectedIndustries, "Documented industry table drifted");
  assert.deepEqual(
    finmatchIndustries,
    industries.map(([value]) => value),
  );

  const unavailableBlock = mapping.split("### Mapping unavailable\n")[1]!.split("## 6.")[0]!;
  const unavailable = JSON.parse(unavailableBlock.match(/```json\n([\s\S]*?)\n```/)![1]!);
  assert.equal(unavailable.mapping_status, "mapping_not_configured");
  assert.equal(unavailable.error_code, "MAPPING_POLICY_MISSING");
  assert.deepEqual(unavailable.risk_aligned_industries, []);
  for (const mapping_policy of [undefined, null]) {
    assert.deepEqual(
      mapRiskToIndustries({
        risk_result: {
          questionnaire_version: unavailable.questionnaire_version,
          total_score: unavailable.total_score,
          risk_profile_bucket: unavailable.risk_profile_bucket,
        },
        ...(mapping_policy === undefined ? {} : { mapping_policy }),
      }),
      unavailable,
      "No-policy output must exactly match the documented failure, without guessed industries",
    );
  }
  for (const total of [7, 11, 12, 16, 17, 21]) {
    let remaining = total - 7;
    const answers = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => {
        const extra = Math.min(remaining, 2);
        remaining -= extra;
        return [`q${index + 1}`, 1 + extra];
      }),
    );
    const bucket = expectedBands.find(({ min, max }) => total >= min && total <= max)!.bucket;
    const result = scoreRiskQuestionnaire({ questionnaire_version: "v0-demo", answers });
    assert.deepEqual(result, {
      questionnaire_version: "v0-demo",
      answers,
      total_score: total,
      risk_profile_bucket: bucket,
    });
    const noPolicy = mapRiskToIndustries({ risk_result: result });
    assert.equal(noPolicy.mapping_status, "mapping_not_configured");
    assert.equal(noPolicy.error_code, "MAPPING_POLICY_MISSING");
    assert.deepEqual(noPolicy.risk_aligned_industries, []);
  }
  console.log(
    "Capability resource checks passed: catalog/source references, exact 7 questions/21 choices, fixed cutoff and industry tables, boundary scoring, and documented no-policy output. No live inference or policy approval is asserted.",
  );
}

if (import.meta.main) main();
