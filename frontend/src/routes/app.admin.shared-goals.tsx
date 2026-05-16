import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useUsers, useShareGoal, useAllGoalsAdmin } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_LIMITS } from "@/constants/rbac";
import { Search } from "lucide-react";

export const Route = createFileRoute("/app/admin/shared-goals")({
  component: SharedGoalsPage,
});

function SharedGoalsPage() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  if (me.role !== "admin") return <Navigate to="/app" />;
  const { data: users, isLoading } = useUsers();
  const { data: allGoals, isLoading: goalsLoading } = useAllGoalsAdmin();
  const share = useShareGoal();
  const [sourceGoalId, setSourceGoalId] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [weightage, setWeightage] = useState<number>(10);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);

  const filteredUsers = (users ?? []).filter((u) => {
    if (u.role !== "employee") return false;
    const s = search.toLowerCase();
    return u.full_name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Shared goals</h1>
        <p className="text-sm text-muted-foreground">Push a department KPI to multiple employees.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribute goal</CardTitle>
          <CardDescription>POST /goals/shared</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setSelectedPhase(""); setSourceGoalId(""); }}>
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
              <Select value={selectedPhase} onValueChange={(v) => { setSelectedPhase(v); setSourceGoalId(""); }} disabled={!selectedYear}>
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
              <Select value={sourceGoalId} onValueChange={setSourceGoalId} disabled={!selectedPhase}>
                <SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger>
                <SelectContent>
                  {allGoals?.filter(g => String(g.year) === selectedYear && g.phase === selectedPhase).map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Weightage (%)</Label>
              <Input
                type="number"
                min={GOAL_LIMITS.MIN_WEIGHTAGE}
                max={GOAL_LIMITS.MAX_WEIGHTAGE}
                value={weightage}
                onChange={(e) => setWeightage(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Recipients</Label>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{ids.length} Selected</span>
            </div>
            
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search employees by name or email..." 
                className="pl-9" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {isLoading ? <Skeleton className="h-40" /> : (
              <div className="max-h-60 overflow-y-auto rounded-md border border-border/60 bg-muted/10 p-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {filteredUsers.map((u) => (
                    <div 
                      key={u.id} 
                      className={`flex items-center gap-3 rounded-sm p-2 transition-colors hover:bg-muted/50 ${selected[u.id] ? "bg-primary/5 border-primary/20" : ""}`}
                    >
                      <Checkbox
                        id={`user-${u.id}`}
                        checked={!!selected[u.id]}
                        onCheckedChange={(v) => setSelected((s) => ({ ...s, [u.id]: !!v }))}
                      />
                      <label htmlFor={`user-${u.id}`} className="flex flex-col cursor-pointer flex-1">
                        <span className="text-sm font-medium">{u.full_name}</span>
                        <span className="text-[10px] text-muted-foreground">{u.email}</span>
                      </label>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                      No matching employees found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setSelected({})}
              disabled={ids.length === 0}
            >
              Clear All
            </Button>
            <Button
              disabled={!sourceGoalId || ids.length === 0 || share.isPending}
              onClick={() => share.mutate({ source_goal_id: sourceGoalId, employee_ids: ids, weightage })}
              className="min-w-[200px]"
            >
              Push to {ids.length} employees
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
