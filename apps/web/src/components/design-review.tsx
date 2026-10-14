import { useMemo, useState } from "react";
import {
  ArrowRight,
  CircleHelp,
  CircleCheck,
  ClipboardList,
  Database,
  LayoutPanelLeft,
  MessageCircleQuestion,
  RotateCcw,
  Save,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "@web-starter/ui/components/button";
import { Input } from "@web-starter/ui/components/input";
import { Textarea } from "@web-starter/ui/components/textarea";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@web-starter/ui/components/field";
import { Alert, AlertTitle, AlertDescription } from "@web-starter/ui/components/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@web-starter/ui/components/card";
import { Separator } from "@web-starter/ui/components/separator";
import { cn } from "@web-starter/ui/lib/utils";
import {
  initialRequirements,
  specSchema,
  type Application,
  type ProductSpec,
  type Requirements,
} from "../lib/contracts";
import { workflowGraph, type WorkflowGraph } from "../lib/planning";

function lines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function DesignReview({
  app,
  disabled,
  onSave,
}: {
  app: Application;
  disabled: boolean;
  onSave: (spec: ProductSpec | undefined, requirements: Requirements) => Promise<void>;
}) {
  const savedSpec = app.workspaceSpec ?? app.spec;
  const savedRequirements = app.requirements ?? initialRequirements();
  const savedForm = {
    name: savedSpec.name,
    purpose: savedSpec.purpose,
    inputs: savedSpec.inputs.join("\n"),
    outputs: savedSpec.outputs.join("\n"),
    constraints: savedSpec.constraints.join("\n"),
    analysisPeriod: savedRequirements.analysisPeriod,
    assumptions: savedRequirements.assumptions.join("\n"),
    missingInputs: savedRequirements.missingInputs.join("\n"),
    questions: savedRequirements.questions,
  };
  // Re-seed the form only when the saved design's content changes, so frequent
  // app refreshes during an agent turn never clobber in-progress edits.
  const savedKey = JSON.stringify(savedForm);
  const [seedKey, setSeedKey] = useState(savedKey);
  const [form, setForm] = useState<typeof savedForm>(
    () => JSON.parse(savedKey) as typeof savedForm,
  );
  const [resetKey, setResetKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  if (savedKey !== seedKey) {
    setSeedKey(savedKey);
    setForm(JSON.parse(savedKey) as typeof savedForm);
    setResetKey((key) => key + 1);
  }
  const record = app.buildRecords?.at(-1);
  const dirty = JSON.stringify(form) !== savedKey;
  const specResult = specSchema.safeParse({
    ...savedSpec,
    name: form.name,
    purpose: form.purpose,
    inputs: lines(form.inputs),
    outputs: lines(form.outputs),
    constraints: lines(form.constraints),
  });
  const requirementsResult: Requirements = {
    analysisPeriod: form.analysisPeriod,
    assumptions: lines(form.assumptions),
    missingInputs: lines(form.missingInputs),
    questions: form.questions,
  };
  const validationError = !specResult.success
    ? specResult.error.issues
        .map((issue) => `${issue.path.join(".") || "spec"}: ${issue.message}`)
        .join("; ")
    : "";
  const unanswered = form.questions.filter((question) => !question.answer.trim()).length;
  async function save() {
    if (!specResult.success || dirty === false) return;
    setSaving(true);
    setSaved(false);
    try {
      await onSave(specResult.data, requirementsResult);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 p-4 pb-10">
      <header className="flex flex-col gap-1">
        <h2 className="studio-display font-medium">Requirements</h2>
        <p className="text-sm text-muted-foreground">
          Answer the agent's questions and review the design before and while your app is built.
          Answers and edits here are yours; the agent records questions but never answers for you.
        </p>
      </header>
      {dirty ? (
        <Alert>
          <ClipboardList />
          <AlertTitle>Draft with unsaved edits</AlertTitle>
          <AlertDescription>
            Save your edits to update the design the agent works from.
          </AlertDescription>
        </Alert>
      ) : unanswered ? (
        <Alert>
          <MessageCircleQuestion />
          <AlertTitle>
            {unanswered} open question{unanswered === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            Answer below, or reply in the chat. Open questions do not block the conversation.
          </AlertDescription>
        </Alert>
      ) : saved ? (
        <Alert>
          <CircleCheck />
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>The reviewed design is up to date.</AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <ClipboardList />
          <AlertTitle>Saved draft</AlertTitle>
          <AlertDescription>
            {form.questions.length
              ? "All recorded questions are answered."
              : "No clarification questions recorded yet."}
          </AlertDescription>
        </Alert>
      )}
      {form.questions.length > 0 && (
        <section aria-label="Clarification questions" className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Clarification questions from the agent
          </h3>
          {form.questions.map((question, index) => {
            const answered = !!question.answer.trim();
            return (
              <Card key={`${resetKey}:${question.id}`} size="sm">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                      {question.question}
                    </span>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                        answered ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {answered ? <CircleCheck /> : <CircleHelp />}
                      {answered ? "Answered" : "Awaiting answer"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    aria-label={`Answer to: ${question.question}`}
                    placeholder="Type your answer…"
                    rows={2}
                    maxLength={1000}
                    disabled={disabled}
                    value={question.answer}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        questions: form.questions.map((item, position) =>
                          position === index ? { ...item, answer: event.target.value } : item,
                        ),
                      })
                    }
                  />
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
      <Separator />
      <fieldset disabled={disabled} className="min-w-0">
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="design-name">App name</FieldLabel>
              <Input
                id="design-name"
                maxLength={80}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="design-period">Analysis period</FieldLabel>
              <Input
                id="design-period"
                maxLength={300}
                placeholder="e.g. Past 3 years of daily prices"
                value={form.analysisPeriod}
                onChange={(event) => setForm({ ...form, analysisPeriod: event.target.value })}
              />
              <FieldDescription>Only periods the platform can actually support.</FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="design-purpose">Purpose</FieldLabel>
            <Textarea
              id="design-purpose"
              rows={3}
              maxLength={4000}
              value={form.purpose}
              onChange={(event) => setForm({ ...form, purpose: event.target.value })}
            />
          </Field>
          {(
            [
              ["inputs", "Inputs", "What the app needs from you or the platform."],
              ["outputs", "Outputs", "What the app shows or produces."],
              ["constraints", "Constraints", "Boundaries the app must respect."],
            ] as const
          ).map(([key, label, description]) => (
            <Field key={key}>
              <FieldLabel htmlFor={`design-${key}`}>{label}</FieldLabel>
              <Textarea
                id={`design-${key}`}
                rows={3}
                value={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
              <FieldDescription>{description} One item per line.</FieldDescription>
            </Field>
          ))}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="design-assumptions">Assumptions</FieldLabel>
              <Textarea
                id="design-assumptions"
                rows={3}
                value={form.assumptions}
                onChange={(event) => setForm({ ...form, assumptions: event.target.value })}
              />
              <FieldDescription>
                One per line. Do not assume unavailable data exists.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="design-missing">Missing inputs</FieldLabel>
              <Textarea
                id="design-missing"
                rows={3}
                value={form.missingInputs}
                onChange={(event) => setForm({ ...form, missingInputs: event.target.value })}
              />
              <FieldDescription>
                One per line. Remove an item only once it is resolved.
              </FieldDescription>
            </Field>
          </div>
        </FieldGroup>
      </fieldset>
      {validationError && (
        <Alert variant="destructive">
          <AlertTitle>Invalid design</AlertTitle>
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={disabled || saving || !!validationError || !dirty}
          onClick={() => void save()}
        >
          <Save data-icon="inline-start" />
          {saving ? "Saving…" : "Save design"}
        </Button>
        <Button
          variant="ghost"
          disabled={disabled || saving || !dirty}
          onClick={() => {
            setForm(savedForm);
            setResetKey((key) => key + 1);
            setSaved(false);
          }}
        >
          <RotateCcw data-icon="inline-start" />
          Reset
        </Button>
        <p className="text-sm text-muted-foreground">
          Transport protocol: <span className="font-mono">{savedSpec.protocol}</span> · fixed for
          this app
        </p>
      </div>
      <Separator />
      <section aria-label="Pre-build status" className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">Pre-build status</h3>
        {record ? (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  {record.readiness !== "blocked" ? (
                    <ShieldCheck className="text-primary" />
                  ) : (
                    <ShieldAlert className="text-destructive" />
                  )}
                  {record.readiness === "live"
                    ? "Feasible — live market data (Tushare)"
                    : record.readiness === "fixture"
                      ? "Feasible — synthetic demo build"
                      : "Blocked"}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Record {record.revision} · {new Date(record.createdAt).toLocaleString()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {record.resolvedCapabilities.map((capability) => (
                  <span
                    key={capability}
                    className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {capability.replaceAll("-", " ")}
                  </span>
                ))}
              </div>
              {record.blockers.length > 0 && (
                <ul className="ml-4 list-disc space-y-1 text-sm text-destructive">
                  {record.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                Data:{" "}
                {record.plan.mode === "fixture"
                  ? "synthetic demo"
                  : `live via ${record.provider} (pending)`}
                {record.companyIds.length ? ` · companies ${record.companyIds.join(", ")}` : ""}
              </p>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">
            No internal build record yet. Describe your app in the chat; feasibility is checked
            before any build.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Passing checks activate a build automatically. Failed changes keep the working app. The
          company table and the Tushare token are platform-managed.
        </p>
      </section>
    </section>
  );
}

const columns = [
  { kind: "data", title: "Information used", Icon: Database },
  { kind: "capability", title: "Steps the app takes", Icon: Sparkles },
  { kind: "output", title: "What you get", Icon: LayoutPanelLeft },
] as const;

const kindNames = { data: "Information", capability: "Step", output: "Result" } as const;

export function WorkflowView({ app }: { app: Application }) {
  const graph: WorkflowGraph = useMemo(
    () => workflowGraph(app.workspaceSpec ?? app.spec, app.requirements, app.buildRecords?.at(-1)),
    [app.spec, app.workspaceSpec, app.requirements, app.buildRecords],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const node = graph.nodes.find((item) => item.id === selected) ?? graph.nodes[0];
  return (
    <section className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 p-4 pb-10">
      <header className="flex flex-col gap-1">
        <h2 className="studio-display font-medium">How your app works</h2>
        <p className="text-sm text-muted-foreground">
          {graph.basis === "build-record"
            ? "Based on your app as it was last built."
            : "Based on the plan so far — nothing has been built yet."}{" "}
          A plain-language summary to help you review the idea. Inside the app these steps may be
          combined or reordered, so the working app itself is always the final word.
        </p>
      </header>
      <div
        role="region"
        aria-label="Workflow nodes by kind"
        className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1.4fr_auto_1fr]"
      >
        {columns.map(({ kind, title, Icon }, index) => (
          <div key={kind} className="contents">
            {index > 0 && (
              <div className="hidden items-center justify-center md:flex" aria-hidden="true">
                <ArrowRight className="text-muted-foreground" />
              </div>
            )}
            <Card size="sm" className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className="size-4 text-muted-foreground" />
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {graph.nodes.filter((item) => item.kind === kind).length ? (
                  graph.nodes
                    .filter((item) => item.kind === kind)
                    .map((item) => (
                      <Button
                        key={item.id}
                        variant={node?.id === item.id ? "secondary" : "ghost"}
                        aria-pressed={node?.id === item.id}
                        className="h-auto justify-start whitespace-normal break-words py-2 text-left text-sm font-normal"
                        onClick={() => setSelected(item.id)}
                      >
                        {item.label}
                      </Button>
                    ))
                ) : (
                  <p className="px-2 py-2 text-sm text-muted-foreground">
                    {kind === "capability" ? "Chosen during the build." : "Nothing yet."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
      {node && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              {node.label}
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-normal text-muted-foreground">
                {kindNames[node.kind]}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {(
                [
                  ["About", node.detail || "Nothing recorded yet."],
                  ["What it uses", node.inputs || "Nothing recorded yet."],
                  ["What it produces", node.outputs || "Nothing recorded yet."],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="font-medium text-muted-foreground">{label}</dt>
                  <dd className="whitespace-pre-wrap break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
