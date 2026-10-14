import { useEffect, useState } from "react";
import { Button } from "@web-starter/ui/components/button";
import { Input } from "@web-starter/ui/components/input";
import { Textarea } from "@web-starter/ui/components/textarea";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@web-starter/ui/components/field";
import { Alert, AlertTitle, AlertDescription } from "@web-starter/ui/components/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@web-starter/ui/components/card";
import { Separator } from "@web-starter/ui/components/separator";
import { specSchema, type Application, type ProductSpec } from "../lib/contracts";
import {
  capabilityRequirements,
  designKey,
  initialRequirements,
  requirementsSchema,
  UNVERIFIED_WARNING,
  type Requirements,
} from "../lib/planning";
import type { RegisteredPlugin } from "../lib/plugins";
import {
  exportCapabilityMarkdown,
  finmatchQuestionnaire,
  finmatchIndustries,
  getCapabilityPorts,
  parseCapabilityMarkdown,
  resolveCapabilityDefinition,
  validateCapabilityPlan,
  SIMULATION_WARNING,
  type CapabilityPlan,
} from "@web-starter/capabilities";
import { download } from "../lib/client";

export function DesignReview({
  app,
  disabled,
  onSave,
  onConfirm,
  onAssess,
  onPlan,
  onSimulate,
  onImportPlan,
}: {
  app: Application;
  disabled: boolean;
  onSave: (spec: ProductSpec, requirements: Requirements) => Promise<void>;
  onConfirm: () => Promise<void>;
  onAssess: () => Promise<void>;
  onPlan: () => Promise<void>;
  onSimulate: () => Promise<void>;
  onImportPlan: (markdown: string) => Promise<void>;
}) {
  const savedSpec = app.workspaceSpec ?? app.spec;
  const savedRequirements = app.requirements ?? initialRequirements();
  const savedPlan = savedRequirements.capabilityPlan;
  const hasUnverified = savedPlan?.steps.some(
    (step) => resolveCapabilityDefinition(step.capabilityId, step.version)?.status === "unverified",
  );
  const expectedRequirements = capabilityRequirements(savedSpec, savedRequirements);
  const initialForm = {
    protocol: savedSpec.protocol,
    name: savedSpec.name,
    purpose: savedSpec.purpose,
    inputs: savedSpec.inputs.join("\n"),
    outputs: savedSpec.outputs.join("\n"),
    constraints: savedSpec.constraints.join("\n"),
    dataSource: savedRequirements.dataSource,
    analysisPeriod: savedRequirements.analysisPeriod,
    assumptions: savedRequirements.assumptions.join("\n"),
    missingInputs: savedRequirements.missingInputs.join("\n"),
    questions: savedRequirements.questions,
    pluginOperations: JSON.stringify(savedRequirements.pluginOperations, null, 2),
  };
  const [form, setForm] = useState(initialForm);
  const [plugins, setPlugins] = useState<RegisteredPlugin[]>([]);
  const [pluginError, setPluginError] = useState("");
  const [savedMarkdown] = useState(() => {
    if (!savedPlan) return "";
    try {
      return exportCapabilityMarkdown(savedPlan);
    } catch {
      return "";
    }
  });
  const [markdown, setMarkdown] = useState(savedMarkdown);
  const markdownDirty = markdown !== savedMarkdown;
  let importedPlan: CapabilityPlan | undefined;
  let markdownError = "";
  if (markdown.trim()) {
    try {
      importedPlan = parseCapabilityMarkdown(markdown).plan;
      const validation = validateCapabilityPlan(importedPlan, expectedRequirements);
      if (!validation.valid)
        markdownError = validation.issues.map((issue) => issue.message).join("\n");
    } catch (error) {
      markdownError = error instanceof Error ? error.message : "Invalid capability Markdown.";
    }
  }
  const planValidation = savedPlan
    ? validateCapabilityPlan(savedPlan, expectedRequirements)
    : undefined;
  useEffect(() => {
    let active = true;
    fetch("/api/plugins", { cache: "no-store" })
      .then(async (response) => {
        const data: { plugins?: RegisteredPlugin[]; error?: string } = await response.json();
        if (!response.ok || data.error)
          throw new Error(data.error ?? "Could not load plugin registry.");
        if (active) setPlugins(data.plugins ?? []);
      })
      .catch(() => {
        if (active)
          setPluginError(
            "Plugin registry unavailable. Enter known registry IDs or retry after refreshing.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const lines = (text: string) =>
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  const specResult = specSchema.safeParse({
    ...savedSpec,
    name: form.name,
    purpose: form.purpose,
    protocol: form.protocol,
    inputs: lines(form.inputs),
    outputs: lines(form.outputs),
    constraints: lines(form.constraints),
  });
  let pluginOperations: unknown;
  let jsonError = "";
  try {
    pluginOperations = JSON.parse(form.pluginOperations.trim() || "[]");
  } catch {
    jsonError = "Plugin operations must be a JSON array of pluginId and operationId objects.";
  }
  const requirementsResult = requirementsSchema.safeParse({
    ...savedRequirements,
    dataSource: form.dataSource,
    analysisPeriod: form.analysisPeriod,
    assumptions: lines(form.assumptions),
    missingInputs: lines(form.missingInputs),
    questions: form.questions,
    pluginOperations,
  });
  const validationError =
    jsonError ||
    (!specResult.success
      ? specResult.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")
      : !requirementsResult.success
        ? requirementsResult.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")
        : "");
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const confirmed = app.confirmedDesign === designKey(savedSpec, savedRequirements);
  const unanswered = savedRequirements.questions.some((question) => !question.answer.trim());
  const confirmReason = dirty
    ? "Save edits before assessing or confirming."
    : validationError
      ? "Resolve validation errors before confirming."
      : unanswered
        ? "Answer all clarification questions before confirming."
        : savedRequirements.missingInputs.length
          ? "Resolve missing inputs and explicitly remove them from the list."
          : app.feasibility?.outcome !== "pass"
            ? "A passing feasibility assessment is required."
            : confirmed
              ? "This exact saved design is already confirmed."
              : "Confirm this exact saved specification and requirements.";
  return (
    <section className="flex min-w-0 flex-col gap-5 p-4">
      <div>
        <h2 className="font-medium">Requirements</h2>
        <p className="text-sm text-muted-foreground">
          Review the design before release. Answers and resolved inputs must come from you.
        </p>
      </div>
      <Alert>
        <AlertTitle>
          {dirty
            ? "Draft with unsaved edits"
            : confirmed
              ? "Saved design confirmed"
              : "Saved draft - not confirmed"}
        </AlertTitle>
        <AlertDescription>
          {confirmReason} Editing or saving a changed design requires a new confirmation.
        </AlertDescription>
      </Alert>
      <fieldset disabled={disabled} className="min-w-0">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="design-name">Name</FieldLabel>
            <Input
              id="design-name"
              value={form.name}
              maxLength={80}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="design-purpose">Purpose</FieldLabel>
            <Textarea
              id="design-purpose"
              value={form.purpose}
              maxLength={4000}
              onChange={(event) => setForm({ ...form, purpose: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="design-protocol">Calculation protocol</FieldLabel>
            <select
              id="design-protocol"
              value={form.protocol}
              disabled={!!app.current}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              onChange={(event) =>
                setForm({ ...form, protocol: event.target.value as ProductSpec["protocol"] })
              }
            >
              <option value="portfolio">Portfolio</option>
              <option value="screening">Screening</option>
              <option value="strategy">Strategy</option>
            </select>
            <FieldDescription>
              Active applications keep their protocol to protect saved data.
            </FieldDescription>
          </Field>
          {(["inputs", "outputs", "constraints"] as const).map((key) => (
            <Field key={key}>
              <FieldLabel htmlFor={`design-${key}`}>
                {key[0].toUpperCase() + key.slice(1)}
              </FieldLabel>
              <Textarea
                id={`design-${key}`}
                rows={3}
                value={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
              <FieldDescription>One item per line.</FieldDescription>
            </Field>
          ))}
          <Field>
            <FieldLabel htmlFor="design-data-source">Data source</FieldLabel>
            <select
              id="design-data-source"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={form.dataSource}
              onChange={(event) =>
                setForm({ ...form, dataSource: event.target.value as Requirements["dataSource"] })
              }
            >
              <option value="user">User-provided data</option>
              <option value="fixtures">Synthetic fixtures</option>
              <option value="tushare">Tushare</option>
              <option value="plugins">Registered plugins</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="design-period">Analysis period</FieldLabel>
            <Input
              id="design-period"
              value={form.analysisPeriod}
              maxLength={300}
              onChange={(event) => setForm({ ...form, analysisPeriod: event.target.value })}
            />
          </Field>
          {(["assumptions", "missingInputs"] as const).map((key) => (
            <Field key={key}>
              <FieldLabel htmlFor={`design-${key}`}>
                {key === "assumptions" ? "Assumptions" : "Missing inputs"}
              </FieldLabel>
              <Textarea
                id={`design-${key}`}
                rows={3}
                value={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
              <FieldDescription>
                {key === "missingInputs"
                  ? "One item per line. Remove an item explicitly only when you have resolved it."
                  : "One item per line. Do not assume unavailable data exists."}
              </FieldDescription>
            </Field>
          ))}
          {form.questions.map((question, index) => (
            <Field key={question.id}>
              <FieldLabel htmlFor={`design-question-${question.id}`}>
                {question.question}
              </FieldLabel>
              <Textarea
                id={`design-question-${question.id}`}
                value={question.answer}
                maxLength={1000}
                onChange={(event) =>
                  setForm({
                    ...form,
                    questions: form.questions.map((item, position) =>
                      position === index ? { ...item, answer: event.target.value } : item,
                    ),
                  })
                }
              />
            </Field>
          ))}
          {!form.questions.length && (
            <p className="text-sm text-muted-foreground">No clarification questions recorded.</p>
          )}
          <Field>
            <FieldLabel htmlFor="design-plugin-operations">
              Plugin operations (optional JSON)
            </FieldLabel>
            <Textarea
              id="design-plugin-operations"
              className="font-mono text-xs"
              rows={4}
              value={form.pluginOperations}
              onChange={(event) => setForm({ ...form, pluginOperations: event.target.value })}
            />
            <FieldDescription>
              Use explicit registry IDs:{" "}
              {`[{"pluginId":"registered-id","operationId":"operation-id"}]`}. An empty array
              selects none; selection does not grant execution permission.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </fieldset>
      <details className="text-sm">
        <summary className="cursor-pointer">Registered plugin operation IDs</summary>
        {pluginError ? (
          <p className="mt-2 text-muted-foreground">{pluginError}</p>
        ) : plugins.length ? (
          <ul className="mt-2 flex flex-col gap-2 break-all">
            {plugins.map((plugin) => (
              <li key={plugin.id}>
                {plugin.name}: <code>{plugin.id}</code>
                <ul>
                  {plugin.operations.map((operation) => (
                    <li key={operation.operationId}>
                      <code>{operation.operationId}</code> ({operation.method} {operation.path})
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted-foreground">No registered operations loaded.</p>
        )}
      </details>
      {validationError && (
        <Alert variant="destructive">
          <AlertTitle>Invalid design</AlertTitle>
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={disabled || !!validationError}
          onClick={() => {
            if (specResult.success && requirementsResult.success)
              void onSave(specResult.data, requirementsResult.data);
          }}
        >
          Save design
        </Button>
        <Button
          variant="outline"
          disabled={disabled || dirty || !!validationError}
          onClick={() => void onAssess()}
        >
          Assess feasibility
        </Button>
        <Button
          variant="outline"
          disabled={
            disabled ||
            dirty ||
            !!validationError ||
            unanswered ||
            !!savedRequirements.missingInputs.length ||
            app.feasibility?.outcome !== "pass" ||
            confirmed
          }
          onClick={() => void onConfirm()}
        >
          Confirm design
        </Button>
      </div>
      <Separator />
      <section className="flex min-w-0 flex-col gap-3" aria-label="Capability plan">
        <h3 className="font-medium">Capability plan</h3>
        <Alert>
          <AlertTitle>
            {hasUnverified
              ? "Mock or unverified capabilities"
              : "Prototype capabilities, not verified analysis"}
          </AlertTitle>
          <AlertDescription>
            {hasUnverified
              ? `${UNVERIFIED_WARNING} Defined product contracts and coverage do not establish validated financial support. Valid bindings and passing preview tests do not satisfy the production verification gate.`
              : `${SIMULATION_WARNING} Valid bindings and passing simulation do not satisfy the production verification gate. Product contracts and coverage remain UNKNOWN.`}
          </AlertDescription>
        </Alert>
        {planValidation && !planValidation.valid && (
          <Alert variant="destructive">
            <AlertTitle>Saved capability plan needs revision</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap break-words">
              {planValidation.issues.map((issue) => issue.message).join("\n")}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={disabled || dirty || markdownDirty || !!validationError}
            onClick={() => void onPlan()}
          >
            Plan capabilities
          </Button>
          <Button
            variant="outline"
            disabled={
              disabled || dirty || markdownDirty || !!validationError || !planValidation?.executable
            }
            onClick={() => void onSimulate()}
          >
            {hasUnverified ? "Preview capabilities" : "Simulate capabilities"}
          </Button>
        </div>
        {(dirty || markdownDirty) && (
          <p className="text-sm text-muted-foreground">
            Save design and Markdown edits before planning or simulating. Save design edits before
            saving capability Markdown.
          </p>
        )}
        {savedPlan ? (
          <>
            <h4 className="text-sm font-medium">Selected definitions</h4>
            {savedPlan.steps.map((step) => {
              const definition = resolveCapabilityDefinition(step.capabilityId, step.version);
              return (
                <Card key={step.id} size="sm">
                  <CardHeader>
                    <CardTitle>
                      {definition?.name ?? step.capabilityId}: {definition?.status ?? "unavailable"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 break-words text-sm">
                    <p>
                      {step.id}: {step.capabilityId}@{step.version}
                    </p>
                    <p>{definition?.purpose ?? "No exact catalog definition found."}</p>
                    <p>
                      Product behavior:{" "}
                      {definition?.id === "CAP-002"
                        ? "Validate the complete documented questionnaire and calculate a private provisional demo result; not a validated suitability assessment"
                        : (definition?.behavior ?? "UNKNOWN")}
                      . Defined product coverage: {definition?.coverage ?? "UNKNOWN"}.
                    </p>
                    {definition?.status === "unverified" && (
                      <p>
                        Validation: unverified. Defined coverage is not validated financial support.
                      </p>
                    )}
                    {!!definition?.sourceDocuments?.length && (
                      <p>Source documents: {definition.sourceDocuments.join("; ")}</p>
                    )}
                    {definition?.unknowns.map((unknown) => (
                      <p key={unknown}>{unknown}</p>
                    ))}
                    {definition?.status === "mock" && (
                      <p>Simulation only: {definition.simulation.behavior}</p>
                    )}
                    {definition && (
                      <>
                        <p>
                          Inputs:{" "}
                          {Object.entries(getCapabilityPorts(definition, "inputs") ?? {})
                            .map(
                              ([name, contract]) =>
                                `${name}: ${contract}${definition.optionalInputs?.includes(name) ? " (optional)" : ""}`,
                            )
                            .join("; ") || "UNKNOWN"}
                        </p>
                        <p>
                          Outputs:{" "}
                          {Object.entries(getCapabilityPorts(definition, "outputs") ?? {})
                            .map(
                              ([name, contract]) =>
                                `${name}: ${contract}${definition.internalOutputs?.includes(name) ? " (private internal handoff; contract only, no values)" : ""}`,
                            )
                            .join("; ") || "UNKNOWN"}
                        </p>
                      </>
                    )}
                    {definition?.id === "CAP-001" && (
                      <p>
                        Industry choices:{" "}
                        {finmatchIndustries
                          .map((industry) =>
                            industry === "fmcg"
                              ? "Fast-moving consumer goods"
                              : industry[0].toUpperCase() + industry.slice(1),
                          )
                          .join(", ")}
                        . No selection means balanced coverage, not an explicit selection of all
                        industries.
                      </p>
                    )}
                    {definition?.id === "CAP-002" && (
                      <details>
                        <summary className="cursor-pointer">
                          Documented questionnaire (v0-demo)
                        </summary>
                        <p className="mt-2">
                          Definition only, not a submitted assessment. Scores and calculated
                          classifications are private.
                        </p>
                        {finmatchQuestionnaire.map((question) => (
                          <div key={question.id} className="mt-3">
                            <h5 className="font-medium">{question.title}</h5>
                            <p>{question.question}</p>
                            <ul className="ml-4 list-disc">
                              {question.choices.map((choice) => (
                                <li key={choice.label}>{choice.text}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </details>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            <h4 className="text-sm font-medium">Requirement coverage</h4>
            {savedPlan.requirements.map((requirement) => {
              const coverage = savedPlan.coverage.find(
                (row) => row.requirementId === requirement.id,
              );
              return (
                <p key={requirement.id} className="break-words text-sm">
                  <strong>{requirement.text}</strong>:{" "}
                  {hasUnverified ? "Model-authored plan coverage" : "fixture-only plan coverage"}:{" "}
                  {coverage?.status ?? "unreported"}.{" "}
                  {hasUnverified
                    ? "Defined product coverage is listed above; requirement support remains unverified."
                    : "Product coverage: UNKNOWN."}{" "}
                  Model-authored rationale (not validated financial support):{" "}
                  {coverage?.reason ?? "No coverage recorded."}
                  {coverage?.stepIds.length ? ` Steps: ${coverage.stepIds.join(", ")}.` : ""}
                </p>
              );
            })}
            {(["gaps", "questions", "assumptions"] as const).map((key) => (
              <div key={key} className="text-sm">
                <h4 className="font-medium">{key[0].toUpperCase() + key.slice(1)}</h4>
                {savedPlan[key].length ? (
                  <ul className="ml-4 list-disc break-words">
                    {savedPlan[key].map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">None recorded; not proof of completeness.</p>
                )}
              </div>
            ))}
            <details className="text-sm">
              <summary className="cursor-pointer">Binding validation and production gaps</summary>
              <ul className="mt-2 ml-4 list-disc break-words">
                {planValidation?.issues.map((issue, index) => (
                  <li key={index}>
                    {issue.code}: {issue.message}
                  </li>
                ))}
              </ul>
            </details>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No saved capability plan.</p>
        )}
        <Field>
          <FieldLabel htmlFor="capability-markdown">Capability Markdown</FieldLabel>
          <Textarea
            id="capability-markdown"
            className="font-mono text-xs"
            rows={10}
            maxLength={1000000}
            value={markdown}
            disabled={disabled}
            onChange={(event) => setMarkdown(event.target.value)}
          />
          <FieldDescription>
            Paste or edit one cd80-capabilities-v1 JSON fence. Parsing is local; only Save sends it
            to the server. The preview below is not the saved plan.
          </FieldDescription>
        </Field>
        {markdownError && (
          <p role="alert" className="whitespace-pre-wrap break-words text-sm text-destructive">
            {markdownError}
          </p>
        )}
        {importedPlan && (
          <details className="text-sm">
            <summary className="cursor-pointer">
              Parsed Markdown preview ({importedPlan.steps.length} steps)
            </summary>
            <pre className="max-w-full overflow-x-auto text-xs">
              {JSON.stringify(importedPlan, null, 2)}
            </pre>
          </details>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={disabled || dirty || !!validationError || !importedPlan || !!markdownError}
            onClick={() => void onImportPlan(markdown)}
          >
            Save capability Markdown
          </Button>
          <Button
            variant="outline"
            disabled={!importedPlan}
            onClick={() => download("capability-plan.md", markdown, "text/markdown")}
          >
            Export Markdown
          </Button>
        </div>
      </section>
      <Separator />
      <section className="flex flex-col gap-3" aria-label="Design feasibility">
        <h3 className="font-medium">Feasibility</h3>
        {app.feasibility ? (
          <>
            <p className="text-sm">
              Outcome: <strong>{app.feasibility.outcome}</strong>. Checked{" "}
              {new Date(app.feasibility.checkedAt).toLocaleString()}.
            </p>
            {dirty && (
              <p className="text-sm text-muted-foreground">
                This report applies to the saved design, not your unsaved edits.
              </p>
            )}
            {app.feasibility.checks.map((check, index) => (
              <Card key={index} size="sm">
                <CardHeader>
                  <CardTitle>
                    {check.area}: {check.status}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p>{check.reason}</p>
                  {check.alternative && <p>Alternative: {check.alternative}</p>}
                </CardContent>
              </Card>
            ))}
            <p className="whitespace-pre-wrap text-sm">
              <strong>Limitations:</strong> {app.feasibility.limitations || "None recorded."}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not assessed. Save the design and request an assessment before confirming.
          </p>
        )}
      </section>
    </section>
  );
}

export function WorkflowView({ app }: { app: Application }) {
  const graph = app.workflow ?? app.preview?.workflow ?? app.current?.workflow;
  const [selected, setSelected] = useState<string | null>(null);
  const node = graph?.nodes.find((item) => item.id === selected) ?? graph?.nodes[0];
  if (!graph)
    return (
      <section className="p-4">
        <h2 className="font-medium">Workflow</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No saved workflow yet. Save or assess the design to request a backend graph.
        </p>
      </section>
    );
  return (
    <section className="flex min-w-0 flex-col gap-4 p-4">
      <div>
        <h2 className="font-medium">Workflow</h2>
        <p className="text-sm text-muted-foreground">
          Basis:{" "}
          {graph.basis === "manifest"
            ? "manifest-declared capabilities"
            : graph.basis === "capability-plan"
              ? "validated capability bindings"
              : graph.basis === "diagnostic"
                ? "diagnostic plan (bindings not validated)"
                : "planned design"}
          . This saved graph shows bindings or conceptual relationships, not executed traces, proven
          runtime execution order, or verified product behavior.
        </p>
        {!app.workflow && (
          <p className="text-sm text-muted-foreground">
            Showing the saved release graph; no application design graph is available.
          </p>
        )}
      </div>
      <div
        className="max-w-full overflow-x-auto pb-2"
        role="region"
        aria-label="Workflow nodes by kind"
        tabIndex={0}
      >
        <div className="relative grid min-w-[36rem] grid-cols-3 gap-3">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 600 100"
            preserveAspectRatio="none"
          >
            <path
              d="M 175 50 L 225 50 M 375 50 L 425 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
            />
            <path
              d="M 217 44 L 225 50 L 217 56 M 417 44 L 425 50 L 417 56"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
            />
          </svg>
          {(["data", "capability", "output"] as const).map((kind) => (
            <Card key={kind} size="sm">
              <CardHeader>
                <CardTitle>
                  {kind === "data" ? "Data" : kind === "capability" ? "Capabilities" : "Outputs"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {graph.nodes
                  .filter((item) => item.kind === kind)
                  .map((item) => (
                    <Button
                      key={item.id}
                      variant={node?.id === item.id ? "secondary" : "outline"}
                      className="h-auto justify-start whitespace-normal break-all py-2 text-left"
                      aria-pressed={node?.id === item.id}
                      onClick={() => setSelected(item.id)}
                    >
                      {item.label}
                    </Button>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <section className="flex flex-col gap-2" aria-label="Workflow edges">
        <h3 className="font-medium">Connections</h3>
        {graph.edges.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {graph.edges.map((edge, index) => (
              <li key={index} className="break-words">
                <strong>
                  {graph.nodes.find((item) => item.id === edge.from)?.label ?? edge.from}
                </strong>
                {" -> "}
                <strong>{graph.nodes.find((item) => item.id === edge.to)?.label ?? edge.to}</strong>
                : {edge.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No connections recorded.</p>
        )}
      </section>
      {node && (
        <Card>
          <CardHeader>
            <CardTitle>Node inspector: {node.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-2 whitespace-pre-wrap break-words">
              <div>
                <dt className="font-medium">ID / kind</dt>
                <dd>
                  {node.id} / {node.kind}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Detail</dt>
                <dd>{node.detail || "None recorded."}</dd>
              </div>
              <div>
                <dt className="font-medium">Inputs</dt>
                <dd>{node.inputs || "None recorded."}</dd>
              </div>
              <div>
                <dt className="font-medium">Outputs</dt>
                <dd>{node.outputs || "None recorded."}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
