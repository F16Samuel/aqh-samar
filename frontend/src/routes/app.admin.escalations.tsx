import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth.store";
import { useEscalations } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";

export const Route = createFileRoute("/app/admin/escalations")({
  component: EscalationsPage,
});

function EscalationsPage() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  if (me.role !== "admin") return <Navigate to="/app" />;
  const { data, isLoading } = useEscalations(true);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Escalations</h1>
        <p className="text-sm text-muted-foreground">Stalled sheets and overdue actions.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All escalations</CardTitle>
          <CardDescription>From /admin/escalations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : !data?.length ? (
            <EmptyState title="Nothing escalated" description="No stalled sheets at the moment." />
          ) : (
            <ul className="space-y-2">
              {data.map((e, i) => (
                <li key={i} className="rounded-md border border-border/60 p-3">
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(e, null, 2)}</pre>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
