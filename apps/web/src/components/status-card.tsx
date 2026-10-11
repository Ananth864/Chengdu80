import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@web-starter/ui/components/card";

// One row of the home page stack overview.
export function StatusCard({
  title,
  description,
  state,
}: {
  title: string;
  description: string;
  state: "ready" | "loading" | "error";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={
              state === "ready"
                ? "size-2 rounded-full bg-primary"
                : state === "loading"
                  ? "size-2 rounded-full bg-muted-foreground"
                  : "size-2 rounded-full bg-destructive"
            }
          />
          {state}
        </div>
      </CardContent>
    </Card>
  );
}
