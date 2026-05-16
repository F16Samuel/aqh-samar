import { createFileRoute, Link } from "@tanstack/react-router";
import { useCreateSheet, useMyGoalSheets } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Plus, ArrowRight } from "lucide-react";
import { SheetStatusBadge } from "@/components/goals/SheetStatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/app/goal-sheets/")({
  component: GoalSheetsList,
});

function GoalSheetsList() {
  const { data, isLoading } = useMyGoalSheets();
  const createSheet = useCreateSheet();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My goal sheets</h1>
          <p className="text-sm text-muted-foreground">
            Drafts, submissions, and approved sheets for your cycles.
          </p>
        </div>
        <Button
          onClick={() => createSheet.mutate()}
          disabled={createSheet.isPending}
        >
          <Plus className="mr-2 h-4 w-4" />
          {createSheet.isPending ? "Creating…" : "New goal sheet"}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All sheets</CardTitle>
          <CardDescription>From /goal-sheets/mine</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : !data || data.length === 0 ? (
            <EmptyState
              title="No goal sheets yet"
              description="Create your first draft sheet to start adding goals for the active cycle."
              action={
                <Button onClick={() => createSheet.mutate()}>
                  <Plus className="mr-2 h-4 w-4" /> Create draft
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sheet ID</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-mono text-xs">{String(s.cycle_id).slice(0, 8)}</TableCell>
                    <TableCell>
                      <SheetStatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to="/app/goal-sheets/$sheetId"
                        params={{ sheetId: s.id }}
                        className="inline-flex items-center gap-1 text-sm text-primary"
                      >
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
