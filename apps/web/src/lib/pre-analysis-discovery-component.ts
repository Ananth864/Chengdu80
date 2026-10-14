export const preAnalysisDiscoveryComponentSource = `import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { cd80 } from "@/lib/cd80";
import {
  companyDiscoveryInputSchema,
  discoveryResultSchema,
  discoverySessionSchema,
  normalizedIndustryPreferenceSchema,
  type DiscoveryResult,
} from "@/lib/company-discovery";
import type { RiskProfileCompleted } from "@/lib/risk-profile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const storageKey = "discovery-watchlist";
const queryKey = ["cd80", "storage", storageKey] as const;
const watchlistSchema = z
  .array(z.string().regex(/^SSE:(?:600|601|603|605|688|689)\\d{3}$/))
  .refine((ids) => new Set(ids).size === ids.length, "Watchlist IDs must be unique.");

type DiscoveryAction =
  | { action: "start" }
  | {
      action: "advance";
      session_state: z.infer<typeof discoverySessionSchema>;
      company_id: string;
      choice: "add" | "skip";
    };

export function CompanyDiscovery({
  riskResult,
  industryPreference,
  onMetricRequest,
}: {
  riskResult: RiskProfileCompleted;
  industryPreference: z.infer<typeof normalizedIndustryPreferenceSchema>;
  onMetricRequest?: (ids: string[]) => void;
}) {
  const client = useQueryClient();
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const inFlight = useRef(false);
  const roundToken = useRef("start");
  const saved = useQuery({
    queryKey,
    queryFn: () => cd80.storage.read(storageKey, watchlistSchema),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const action = useMutation({
    retry: false,
    mutationFn: async (input: DiscoveryAction) => {
      let watchlist: string[] | undefined;
      const request =
        input.action === "start"
          ? {
              action: "start" as const,
              ...companyDiscoveryInputSchema.parse({
                risk_result: riskResult,
                industry_preference: industryPreference,
                watchlist: (await cd80.storage.read(storageKey, watchlistSchema)) ?? [],
              }),
            }
          : { ...input, session_state: discoverySessionSchema.parse(input.session_state) };
      const next = discoveryResultSchema.parse(await cd80.finance.companyDiscovery(request));
      if (next.status === "invalid_input") throw new Error("Discovery request rejected.");
      if (input.action === "start") {
        if (next.status !== "ready" && next.status !== "exhausted")
          throw new Error("Invalid discovery start response.");
        watchlist = request.action === "start" ? request.watchlist : undefined;
      } else {
        if (next.status !== "ready" && next.status !== "session_completed")
          throw new Error("Invalid discovery advance response.");
        if (
          next.session_state.session_id !== input.session_state.session_id ||
          next.session_state.round_index !== input.session_state.round_index + 1 ||
          next.session_state.ordered_company_ids.join(",") !==
            input.session_state.ordered_company_ids.join(",")
        )
          throw new Error("Invalid discovery transition.");
        const added = "watchlist_add" in next ? next.watchlist_add : undefined;
        if (input.choice === "add") {
          if (!added || \`SSE:\${added.ticker}\` !== input.company_id)
            throw new Error("Invalid watchlist addition.");
          const canonical = (await cd80.storage.read(storageKey, watchlistSchema)) ?? [];
          watchlist = watchlistSchema.parse([...new Set([...canonical, \`SSE:\${added.ticker}\`])]);
          // Keep the previous card until durable watchlist storage acknowledges this Add.
          await cd80.storage.write(storageKey, watchlist);
        } else if (added) {
          throw new Error("Unexpected watchlist addition.");
        }
      }
      return { next, watchlist };
    },
    onSuccess: ({ next, watchlist }) => {
      if (watchlist !== undefined) client.setQueryData(queryKey, watchlist);
      roundToken.current =
        next.status === "ready" ? \`\${next.session_id}:\${next.session_state.round_index}\` : "start";
      setResult(next);
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const token =
    result?.status === "ready"
      ? \`\${result.session_id}:\${result.session_state.round_index}\`
      : "start";
  const busy = action.isPending || saved.isPending || saved.isFetching || saved.isError;
  function submit(input: DiscoveryAction) {
    if (busy || inFlight.current || roundToken.current !== token) return;
    if (input.action === "start" && result?.status === "ready") return;
    inFlight.current = true;
    action.mutate(input);
  }

  return (
    <section aria-label="Company discovery" className="min-w-0 space-y-5">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Company discovery</h2>
        <p className="text-sm text-muted-foreground">
          Review one company at a time. Only your watchlist is saved; leaving or reloading discards
          the discovery session. Nothing starts automatically.
        </p>
      </div>
      {saved.isPending && <p role="status">Loading saved watchlist...</p>}
      {saved.isError && (
        <Alert variant="destructive">
          <AlertTitle>Watchlist unavailable</AlertTitle>
          <AlertDescription>
            Saved company IDs could not be loaded or validated. Discovery is paused to avoid
            overwriting your watchlist.
            <Button
              type="button"
              variant="outline"
              disabled={saved.isFetching || action.isPending}
              onClick={() => void saved.refetch()}
            >
              Retry loading watchlist
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {action.isError && (
        <Alert variant="destructive">
          <AlertTitle>Discovery action could not be completed</AlertTitle>
          <AlertDescription>
            The response could not be validated or the watchlist could not be saved. Your current
            card has not advanced. Try the action again.
          </AlertDescription>
        </Alert>
      )}
      {result?.status === "ready" && (
        <Card className="min-w-0" aria-busy={action.isPending}>
          <CardHeader>
            <CardDescription>
              Company {result.current_round} of {result.total_rounds}
            </CardDescription>
            <CardTitle className="break-words">{result.current_company.name}</CardTitle>
            <CardDescription className="break-words">
              SSE:{result.current_company.ticker} / {result.current_company.industry}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Financial metrics are unavailable.</p>
            {onMetricRequest && (
              <Button
                type="button"
                variant="outline"
                disabled={action.isPending}
                onClick={() => onMetricRequest([...result.metric_request_company_ids])}
              >
                Request company metrics
              </Button>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                submit({
                  action: "advance",
                  session_state: result.session_state,
                  company_id: \`SSE:\${result.current_company.ticker}\`,
                  choice: "add",
                })
              }
            >
              Add to watchlist
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                submit({
                  action: "advance",
                  session_state: result.session_state,
                  company_id: \`SSE:\${result.current_company.ticker}\`,
                  choice: "skip",
                })
              }
            >
              Skip
            </Button>
          </CardFooter>
        </Card>
      )}
      {result?.status === "session_completed" && (
        <p role="status">Session completed. Start a new session using your latest watchlist.</p>
      )}
      {result?.status === "exhausted" && (
        <div className="space-y-2">
          <p role="status">{result.user_message}</p>
          <p className="text-sm text-muted-foreground">
            Waiting does not refresh the dataset. New matches require a dataset update, different
            validated preferences, or changes to your saved watchlist.
          </p>
        </div>
      )}
      {(!result || result.status === "session_completed" || result.status === "exhausted") && (
        <Button type="button" disabled={busy} onClick={() => submit({ action: "start" })}>
          {action.isPending
            ? "Starting session..."
            : result
              ? "Start new session"
              : "Start discovery"}
        </Button>
      )}
      {action.isPending && <p role="status">Completing discovery action...</p>}
      {result && "catalog_validation" in result && (
        <p className="text-sm text-muted-foreground">
          Catalog validation: {result.catalog_validation.excluded_record_count} records excluded
          because they were invalid, duplicated, or conflicting.
        </p>
      )}
      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer font-medium">Dataset limitations</summary>
        <p className="pt-2">
          Discovery uses the supplied Shanghai Stock Exchange catalog and its supported industries,
          not a live or comprehensive market feed. Catalog records may be incomplete or outdated;
          validation does not verify source accuracy or freshness. Each session contains at most
          five companies and excludes saved watchlist IDs. Skipped companies may appear in a new
          session. No live quotes or verified financial metrics are provided. Discovery is not
          investment advice.
        </p>
      </details>
      <div className="space-y-2">
        <h3 className="font-medium">Saved watchlist</h3>
        {saved.isSuccess &&
          (saved.data?.length ? (
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {saved.data.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No saved companies yet.</p>
          ))}
      </div>
    </section>
  );
}
`;
