import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
export function MetricCard({ label, value }: { label: string; value: string | number | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>{value ?? "Unavailable"}</CardContent>
    </Card>
  );
}
