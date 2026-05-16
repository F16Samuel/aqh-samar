import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useUnlockGoal } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Unlock } from "lucide-react";

export const Route = createFileRoute("/app/admin/unlock")({
  component: UnlockPage,
});

function UnlockPage() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  if (me.role !== "admin") return <Navigate to="/app" />;
  const [goalId, setGoalId] = useState("");
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
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Goal ID</Label>
            <Input value={goalId} onChange={(e) => setGoalId(e.target.value)} placeholder="UUID" />
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
