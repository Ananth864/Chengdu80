import { useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { cd80 } from "@/lib/cd80";
import { supportedIndustries, industryPreferenceResultSchema } from "@/lib/industry-preference";
import { normalizedIndustryPreferenceSchema } from "@/lib/company-discovery";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const storageKey = "industry-preference";
const queryKey = ["cd80", "storage", storageKey] as const;
type NormalizedPreference = z.infer<typeof normalizedIndustryPreferenceSchema>;

export function IndustryPreference({
  onCompleted,
}: {
  onCompleted?: (preference: NormalizedPreference) => void;
}) {
  const id = useId();
  const client = useQueryClient();
  // An empty draft is not a saved all-supported preference until explicitly submitted.
  const [selected, setSelected] = useState<NormalizedPreference["selected_industries"]>([]);
  const [editing, setEditing] = useState(false);
  const inFlight = useRef(false);
  const stored = useQuery({
    queryKey,
    queryFn: () => cd80.storage.read(storageKey, normalizedIndustryPreferenceSchema),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const save = useMutation({
    retry: false,
    mutationFn: async (selected_industries: NormalizedPreference["selected_industries"]) => {
      const result = industryPreferenceResultSchema.parse(
        await cd80.finance.industryPreferences({
          operation: "capture_preferences",
          selected_industries,
        }),
      );
      if (result.status !== "completed" || !("industry_preference" in result))
        throw new Error("Industry preferences rejected.");
      const preference = normalizedIndustryPreferenceSchema.parse(result.industry_preference);
      await cd80.storage.write(storageKey, preference);
      return preference;
    },
    onSuccess: (preference) => {
      client.setQueryData(queryKey, preference);
      setSelected([]);
      setEditing(false);
      onCompleted?.(preference);
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const busy = save.isPending || stored.isPending || stored.isFetching || stored.isError;

  return (
    <Card aria-busy={save.isPending}>
      <CardHeader>
        <CardTitle>Industry preferences</CardTitle>
        <CardDescription id={`${id}-description`}>
          Choose any of the five supported industries, or leave all unchecked. Saving no selection
          allows random company discovery across these five industries, subject to the separate
          risk-based company-size filter. Equal representation of industries is not guaranteed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {stored.isPending ? (
          <p role="status">Loading industry preferences...</p>
        ) : stored.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Saved industry preferences unavailable</AlertTitle>
            <AlertDescription>
              Saved preferences could not be loaded or validated. Saving is paused to avoid
              overwriting your saved intent.
              <Button
                type="button"
                variant="outline"
                disabled={stored.isFetching || save.isPending}
                onClick={() => void stored.refetch()}
              >
                Retry loading preferences
              </Button>
            </AlertDescription>
          </Alert>
        ) : stored.data && !editing ? (
          <div className="space-y-4">
            <p role="status">Industry preferences saved.</p>
            <p>
              {stored.data.selection_mode === "all_supported"
                ? "No industries selected: all five supported industries are allowed."
                : "Selected industries:"}
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {stored.data.effective_industries.map((industryId) => (
                <li key={industryId}>
                  {supportedIndustries.find((industry) => industry.id === industryId)?.label}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (busy || inFlight.current || !stored.data) return;
                setSelected([...stored.data.selected_industries]);
                save.reset();
                setEditing(true);
              }}
            >
              Edit preferences
            </Button>
          </div>
        ) : (
          <form
            className="space-y-6"
            aria-describedby={`${id}-description`}
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || inFlight.current) return;
              inFlight.current = true;
              save.mutate([...selected]);
            }}
          >
            <p className="text-sm text-muted-foreground">
              Nothing is saved until you click Save industry preferences. Unsaved changes are
              discarded when you cancel, leave, or reload. Preferences are not inferred from your
              questionnaire answers.
            </p>
            <FieldSet disabled={busy} aria-describedby={`${id}-description`}>
              <FieldLegend>Supported industries</FieldLegend>
              {supportedIndustries.map((industry) => (
                <Field key={industry.id} orientation="horizontal" data-disabled={busy}>
                  <Checkbox
                    id={`${id}-${industry.id}`}
                    name="selected_industries"
                    value={industry.id}
                    checked={selected.includes(industry.id)}
                    disabled={busy}
                    onCheckedChange={(checked) => {
                      if (busy || inFlight.current) return;
                      setSelected((current) =>
                        checked
                          ? current.includes(industry.id)
                            ? current
                            : [...current, industry.id]
                          : current.filter((industryId) => industryId !== industry.id),
                      );
                    }}
                  />
                  <FieldLabel htmlFor={`${id}-${industry.id}`}>{industry.label}</FieldLabel>
                </Field>
              ))}
            </FieldSet>
            {save.isError && (
              <Alert variant="destructive">
                <AlertTitle>Industry preferences could not be saved</AlertTitle>
                <AlertDescription>
                  The response could not be validated or storage did not acknowledge the save. Your
                  draft has been kept. Try saving again.
                </AlertDescription>
              </Alert>
            )}
            {save.isPending && <p role="status">Saving industry preferences...</p>}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={busy}>
                Save industry preferences
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (busy || inFlight.current) return;
                  setSelected([]);
                  setEditing(false);
                  save.reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
