import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cd80 } from "@/lib/cd80";
import {
  completedRiskProfileSchema,
  riskProfileInputSchema,
  riskProfileResultSchema,
  riskQuestionnaireDefinition,
  type RiskProfileCompleted,
  type RiskProfileInput,
} from "@/lib/risk-profile";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Field, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";

const storageKey = "risk-profile";
const queryKey = ["cd80", "storage", storageKey] as const;

export function RiskQuestionnaire({
  onCompleted,
}: {
  onCompleted?: (result: RiskProfileCompleted) => void;
}) {
  const id = useId();
  const client = useQueryClient();
  const [answers, setAnswers] = useState<Partial<RiskProfileInput["answers"]>>({});
  const [retaking, setRetaking] = useState(false);
  const stored = useQuery({
    queryKey,
    queryFn: () => cd80.storage.read(storageKey, completedRiskProfileSchema),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const submit = useMutation({
    retry: false,
    mutationFn: async (input: RiskProfileInput) => {
      const result = riskProfileResultSchema.parse(await cd80.finance.riskProfile(input));
      if (result.status !== "completed") throw new Error("Questionnaire submission rejected.");
      const completed = completedRiskProfileSchema.parse(result);
      await cd80.storage.write(storageKey, completed);
      return completed;
    },
  });
  const input = riskProfileInputSchema.safeParse({
    questionnaire_version: riskQuestionnaireDefinition.version,
    answers,
  });
  const completed = !!stored.data && !retaking;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk questionnaire</CardTitle>
        <CardDescription id={`${id}-disclaimer`}>
          This provisional demo questionnaire is not an official suitability assessment or a
          validated assessment. Expected returns are not forecasts or promises.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {stored.isPending ? (
          <p role="status">Loading questionnaire...</p>
        ) : completed ? (
          <div className="space-y-4">
            <p role="status">Questionnaire completed.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAnswers({});
                submit.reset();
                setRetaking(true);
              }}
            >
              Retake questionnaire
            </Button>
          </div>
        ) : (
          <form
            className="space-y-6"
            aria-describedby={`${id}-disclaimer`}
            onSubmit={(event) => {
              event.preventDefault();
              if (!input.success || submit.isPending) return;
              submit.mutate(input.data, {
                onSuccess: (result) => {
                  client.setQueryData(queryKey, result);
                  setAnswers({});
                  setRetaking(false);
                  onCompleted?.(result);
                },
              });
            }}
          >
            <p className="text-sm text-muted-foreground">
              Choose one answer for each question. Unsubmitted answers are discarded when you
              cancel, leave, or reload.
            </p>
            {riskQuestionnaireDefinition.questions.map((question) => (
              <FieldSet key={question.id} disabled={submit.isPending}>
                <FieldLegend>{question.text}</FieldLegend>
                {question.choices.map((choice) => {
                  const choiceId = `${id}-${question.id}-${choice.label}`;
                  return (
                    <Field key={choice.label} orientation="horizontal">
                      <input
                        id={choiceId}
                        type="radio"
                        name={question.id}
                        value={choice.label}
                        required
                        checked={answers[question.id] === choice.score}
                        onChange={() =>
                          setAnswers((current) => ({
                            ...current,
                            [question.id]: choice.score,
                          }))
                        }
                      />
                      <FieldLabel htmlFor={choiceId}>
                        {choice.label}: {choice.text}
                      </FieldLabel>
                    </Field>
                  );
                })}
              </FieldSet>
            ))}
            {submit.isError && (
              <Alert variant="destructive">
                <AlertTitle>Questionnaire could not be completed</AlertTitle>
                <AlertDescription>
                  Check that every question has an answer and try again. Your submission could not
                  be validated or saved.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={!input.success || submit.isPending}>
                {submit.isPending ? "Submitting..." : "Complete questionnaire"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={submit.isPending}
                onClick={() => {
                  setAnswers({});
                  submit.reset();
                  setRetaking(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
        {stored.isError && (
          <Alert variant="destructive">
            <AlertTitle>Saved questionnaire unavailable</AlertTitle>
            <AlertDescription>
              A saved completion could not be loaded or validated. You can complete a new
              questionnaire or{" "}
              <button
                type="button"
                className="underline"
                disabled={stored.isFetching || submit.isPending}
                onClick={() => void stored.refetch()}
              >
                try loading again
              </button>
              .
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
