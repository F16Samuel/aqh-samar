import { createFileRoute, Link } from "@tanstack/react-router";
import { useCreateSheet, useMyGoalSheets } from "@/hooks/api";
import { useAuthStore } from "@/store/auth.store";
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
  const me = useAuthStore((s) => s.profile);
  const { data: mySheets, isLoading: loadingMine } = useMyGoalSheets();
  const createSheet = useCreateSheet();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Goal Sheets</h1>
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
          <CardTitle className="text-base">My Sheets</CardTitle>
          <CardDescription>Drafts and approved goals for your own tracking.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMine ? (
            <Skeleton className="h-32" />
          ) : !mySheets || mySheets.length === 0 ? (
            <EmptyState
              title="No personal sheets"
              description="You haven't created any goal sheets for yourself yet."
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
                {mySheets.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-xs">
                      Sheet #{s.id.slice(0, 4).toUpperCase()}
                    </TableCell>
                    <TableCell>{s.cycle_label || "Active Cycle"}</TableCell>
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
