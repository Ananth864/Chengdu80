import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { cd80 } from "@/lib/cd80";
import {
  discoveryResultSchema,
  discoverySessionSchema,
  normalizedIndustryPreferenceSchema,
  type DiscoveryResult,
} from "@/lib/company-discovery";
import { discoveryContractRequestSchema } from "@/lib/discovery-contract";
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
  .array(z.string().regex(/^SSE:(?:600|601|603|605|688|689)\d{3}$/))
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
  enableWatchlist = false,
}: {
  riskResult: RiskProfileCompleted;
  industryPreference: z.infer<typeof normalizedIndustryPreferenceSchema>;
  onMetricRequest?: (ids: string[]) => void;
  enableWatchlist?: boolean;
}) {
  const client = useQueryClient();
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const inFlight = useRef(false);
  const roundToken = useRef("start");
  const saved = useQuery({
    queryKey,
    enabled: enableWatchlist,
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
      let currentCompanyId: string | undefined;
      if (input.action === "start") {
        if (enableWatchlist)
          watchlist = (await cd80.storage.read(storageKey, watchlistSchema)) ?? [];
      } else {
        const current = discoveryResultSchema.parse(result);
        if (
          current.status !== "ready" ||
          current.session_state.session_id !== input.session_state.session_id ||
          current.session_state.round_index !== input.session_state.round_index ||
          current.session_state.ordered_company_ids.join(",") !==
            input.session_state.ordered_company_ids.join(",")
        )
          throw new Error("Invalid current discovery round.");
        currentCompanyId = `SSE:${current.current_company.ticker}`;
        if (
          input.company_id !== currentCompanyId ||
          current.session_state.ordered_company_ids[current.session_state.round_index] !==
            currentCompanyId ||
          (input.choice === "add" && !enableWatchlist)
        )
          throw new Error("Invalid current discovery company.");
      }
      const request = discoveryContractRequestSchema.parse(
        input.action === "start"
          ? {
              action: "start",
              risk_result: riskResult,
              industry_preference: industryPreference,
              ...(enableWatchlist ? { excluded_company_ids: watchlist } : {}),
            }
          : {
              action: "advance",
              session_state: discoverySessionSchema.parse(input.session_state),
              company_id: currentCompanyId,
            },
      );
      const response = await cd80.finance.companyDiscoveryContract(request);
      if (response && typeof response === "object" && "watchlist_add" in response)
        throw new Error("Unexpected watchlist addition.");
      const next = discoveryResultSchema.parse(response);
      if (next.status === "invalid_input") throw new Error("Discovery request rejected.");
      if (input.action === "start") {
        if (next.status !== "ready" && next.status !== "exhausted")
          throw new Error("Invalid discovery start response.");
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
        if (enableWatchlist && input.choice === "add") {
          if (!currentCompanyId) throw new Error("Invalid watchlist addition.");
          const canonical = (await cd80.storage.read(storageKey, watchlistSchema)) ?? [];
          watchlist = watchlistSchema.parse([...new Set([...canonical, currentCompanyId])]);
          // Keep the previous card until durable watchlist storage acknowledges this Add.
          await cd80.storage.write(storageKey, watchlist);
        }
      }
      return { next, watchlist };
    },
    onSuccess: ({ next, watchlist }) => {
      if (watchlist !== undefined) client.setQueryData(queryKey, watchlist);
      roundToken.current =
        next.status === "ready" ? `${next.session_id}:${next.session_state.round_index}` : "start";
      setResult(next);
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const token =
    result?.status === "ready"
      ? `${result.session_id}:${result.session_state.round_index}`
      : "start";
  const busy =
    action.isPending || (enableWatchlist && (saved.isPending || saved.isFetching || saved.isError));
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
          Review one company at a time. {enableWatchlist && "Only your watchlist is saved; "}
          Leaving or reloading discards the discovery session. Nothing starts automatically.
        </p>
      </div>
      {enableWatchlist && saved.isPending && <p role="status">Loading saved watchlist...</p>}
      {enableWatchlist && saved.isError && (
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
            The response could not be validated
            {enableWatchlist && " or the watchlist could not be saved"}. Your current card has not
            advanced. Try the action again.
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
            {enableWatchlist && (
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  submit({
                    action: "advance",
                    session_state: result.session_state,
                    company_id: `SSE:${result.current_company.ticker}`,
                    choice: "add",
                  })
                }
              >
                Add to watchlist
              </Button>
            )}
            <Button
              type="button"
              variant={enableWatchlist ? "outline" : "default"}
              disabled={busy}
              onClick={() =>
                submit({
                  action: "advance",
                  session_state: result.session_state,
                  company_id: `SSE:${result.current_company.ticker}`,
                  choice: "skip",
                })
              }
            >
              {enableWatchlist ? "Skip" : "Next company"}
            </Button>
          </CardFooter>
        </Card>
      )}
      {result?.status === "session_completed" && (
        <p role="status">
          Session completed. Start a new session
          {enableWatchlist ? " using your latest watchlist" : ""}.
        </p>
      )}
      {result?.status === "exhausted" && (
        <div className="space-y-2">
          <p role="status">{result.user_message}</p>
          <p className="text-sm text-muted-foreground">
            Waiting does not refresh the dataset. New matches require a dataset update, different
            validated preferences{enableWatchlist ? ", or changes to your saved watchlist" : ""}.
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
          five companies{enableWatchlist ? " and excludes saved watchlist IDs" : ""}. Previously
          viewed or skipped companies may appear in a new session. No live quotes or verified
          financial metrics are provided. Discovery is not investment advice.
        </p>
      </details>
      {enableWatchlist && (
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
      )}
    </section>
  );
}
