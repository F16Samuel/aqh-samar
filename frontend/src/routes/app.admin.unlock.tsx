import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useUnlockGoal, useAllGoalsAdmin } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Unlock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/admin/unlock")({
  component: UnlockPage,
});

function UnlockPage() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  if (me.role !== "admin") return <Navigate to="/app" />;
  const [goalId, setGoalId] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const { data: allGoals, isLoading } = useAllGoalsAdmin();
  const unlock = useUnlockGoal();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Goal unlock</h1>
        <p className="text-sm text-muted-foreground">Unlock an approved goal so the employee can edit it.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unlock goal</CardTitle>
          <CardDescription>POST /admin/unlock/{"{goal_id}"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setSelectedPhase(""); setGoalId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(allGoals?.map(g => g.year))).sort((a,b) => b-a).map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Phase / Quarter</Label>
              <Select value={selectedPhase} onValueChange={(v) => { setSelectedPhase(v); setGoalId(""); }} disabled={!selectedYear}>
                <SelectTrigger><SelectValue placeholder="Select phase" /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(allGoals?.filter(g => String(g.year) === selectedYear).map(g => g.phase))).map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Goal Name</Label>
              <Select value={goalId} onValueChange={setGoalId} disabled={!selectedPhase}>
                <SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger>
                <SelectContent>
                  {allGoals?.filter(g => String(g.year) === selectedYear && g.phase === selectedPhase).map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            disabled={!goalId || unlock.isPending}
            onClick={() => unlock.mutate(goalId)}
          >
            <Unlock className="mr-2 h-4 w-4" /> Unlock
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
