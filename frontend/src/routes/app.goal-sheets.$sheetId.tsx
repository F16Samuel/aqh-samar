import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useGoalsBySheet,
  useGoalSheet,
  useActiveCycle,
  useCreateGoal,
  useUpdateGoal,
  useSubmitSheet,
  useApproveSheet,
  useReturnSheet,
  useCheckinsBySheet,
  useCreateCheckin,
  useUnlockGoal,
  useShareGoal,
  useUsers,
} from "@/hooks/api";
import { useAuthStore } from "@/store/auth.store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { goalFormSchema, validateSheetForSubmission, type GoalFormValues } from "@/schemas/forms";
import { QUARTERS, UOM_TYPES, GOAL_LIMITS } from "@/constants/rbac";
import { Lock, Plus, ArrowLeft, Share2, Send, RotateCcw, CheckCircle2, Unlock as UnlockIcon } from "lucide-react";
import { SheetStatusBadge } from "@/components/goals/SheetStatusBadge";
import { EmptyState } from "@/components/feedback/EmptyState";
import { toast } from "sonner";

export const Route = createFileRoute("/app/goal-sheets/$sheetId")({
  component: SheetDetail,
});

function SheetDetail() {
  const { sheetId } = useParams({ from: "/app/goal-sheets/$sheetId" });
  const me = useAuthStore((s) => s.profile);
  const { data: sheet } = useGoalSheet(sheetId);
  const { data: goals, isLoading } = useGoalsBySheet(sheetId);
  const submit = useSubmitSheet();
  const approve = useApproveSheet();
  const returnFn = useReturnSheet();
  const unlockGoal = useUnlockGoal();

  const weightages = (goals ?? []).map((g) => g.weightage);
  const totalW = weightages.reduce((a, b) => a + b, 0);
  const submitCheck = validateSheetForSubmission(weightages);
  const status = String(sheet?.status ?? "").toLowerCase();
  const { data: activeCycle } = useActiveCycle();
  const today = new Date().toISOString().split('T')[0];
  const windowIsOpen = activeCycle?.is_active && activeCycle.window_open && activeCycle.window_close
    ? today >= activeCycle.window_open && today <= activeCycle.window_close
    : false;

  const isLocked = status === "approved" || status === "locked" || (goals ?? []).every((g) => g.is_locked);
  const canEdit = !isLocked && (status === "draft" || status === "returned" || ((me?.role === "manager" || me?.role === "admin") && status === "submitted") || !sheet);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app/goal-sheets" className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to sheets
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Sheet · #{sheetId.slice(0, 4).toUpperCase()}</h1>
            <p className="text-sm text-muted-foreground">
              {sheet?.cycle_label || "..."} · {(goals ?? []).length} of {GOAL_LIMITS.MAX_GOALS} goals · Total weightage {totalW}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sheet && <SheetStatusBadge status={sheet.status} />}
            {(status === "draft" || status === "rework" || status === "returned") && sheet?.employee_id === me?.id && (
              <Button
                onClick={() => {
                  if (!submitCheck.ok) {
                    toast.error(submitCheck.reason!);
                    return;
                  }
                  submit.mutate(sheetId);
                }}
                disabled={submit.isPending || !submitCheck.ok || !windowIsOpen}
              >
                <Send className="mr-2 h-4 w-4" /> Submit for review
              </Button>
            )}
            {me?.role === "manager" && status === "submitted" && (
              <>
                <Button
                  variant="default"
                  onClick={() => approve.mutate(sheetId)}
                  disabled={approve.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                </Button>
                <ReturnDialog
                  onSubmit={(comment) => returnFn.mutate({ id: sheetId, comment })}
                  pending={returnFn.isPending}
                />
              </>
            )}
          </div>
        </div>
      </div>
      
      {!windowIsOpen && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive border border-destructive/20">
          <strong>Window closed.</strong> You cannot add goals or submit sheets at this time.
        </div>
      )}

      {(me?.role === "manager" || me?.role === "admin") && status === "submitted" && sheet?.employee_id !== me?.id && (
        <div className="rounded-md bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center justify-between">
          <div>
            <strong>Pending your approval.</strong> Please review the goals below. You can make minor adjustments if necessary before approving, or return the sheet for rework with comments.
          </div>
        </div>
      )}

      <Card className={!submitCheck.ok ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20" : "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20"}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              Submission Readiness
              {submitCheck.ok ? (
                <Badge variant="default" className="bg-emerald-600">Ready</Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-600">Action Required</Badge>
              )}
            </CardTitle>
            <CardDescription className={!submitCheck.ok ? "text-amber-700 dark:text-amber-400 font-medium" : "text-emerald-700 dark:text-emerald-400"}>
              {submitCheck.ok 
                ? "Your sheet meets all business rules and is ready for review."
                : submitCheck.reason}
            </CardDescription>
          </div>
          <div className="w-64">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Total Weightage</span>
              <span className={totalW === 100 ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>{totalW}%</span>
            </div>
            <Progress 
              value={Math.min(totalW, 100)} 
              className={totalW === 100 ? "bg-emerald-100 [&>div]:bg-emerald-600" : "bg-amber-100 [&>div]:bg-amber-600"} 
            />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Goals</CardTitle>
            <CardDescription>From /goals?sheet_id=…</CardDescription>
          </div>
          {canEdit && (goals ?? []).length < GOAL_LIMITS.MAX_GOALS && windowIsOpen && (
            <GoalDialog sheetId={sheetId} />
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : !goals || goals.length === 0 ? (
            <EmptyState
              title="No goals yet"
              description="Add up to 8 goals with weightages that total 100%."
              action={canEdit && windowIsOpen ? <GoalDialog sheetId={sheetId} /> : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thrust area</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead>UoM</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>{g.thrust_area}</TableCell>
                    <TableCell>
                      <div className="font-medium">{g.title}</div>
                      {g.description && (
                        <div className="text-xs text-muted-foreground">{g.description}</div>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {g.is_locked && (
                          <Badge variant="outline" className="gap-1">
                            <Lock className="h-3 w-3" /> Locked
                          </Badge>
                        )}
                        {g.shared_from && (
                          <Badge variant="outline" className="gap-1">
                            <Share2 className="h-3 w-3" /> Shared
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{g.uom_type}</Badge></TableCell>
                    <TableCell>{g.target}</TableCell>
                    <TableCell>{g.weightage}%</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {me?.role === "admin" && g.is_locked && (
                          <Button variant="outline" size="sm" onClick={() => unlockGoal.mutate(g.id)} disabled={unlockGoal.isPending}>
                            <UnlockIcon className="mr-2 h-3 w-3" /> Unlock
                          </Button>
                        )}
                        {me?.role === "admin" && !g.is_locked && (
                          <ShareGoalDialog goal={g} />
                        )}
                        {!g.is_locked && canEdit && windowIsOpen && (
                          <GoalDialog sheetId={sheetId} goal={g} sharedReadonly={!!g.shared_from} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CheckinsCard sheetId={sheetId} canPost={me?.role === "manager" || me?.role === "admin"} windowIsOpen={windowIsOpen} />
    </div>
  );
}

function GoalDialog({
  sheetId,
  goal,
  sharedReadonly = false,
}: {
  sheetId: string;
  goal?: import("@/types/api").GoalOut;
  sharedReadonly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const create = useCreateGoal(sheetId);
  const update = useUpdateGoal(sheetId);
  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: goal
      ? {
          thrust_area: goal.thrust_area,
          title: goal.title,
          description: goal.description ?? "",
          uom_type: goal.uom_type,
          target: Number(goal.target),
          weightage: goal.weightage,
        }
      : {
          thrust_area: "",
          title: "",
          description: "",
          uom_type: "min",
          target: undefined as unknown as number,
          weightage: 10,
        },
  });

  const onSubmit = async (values: GoalFormValues) => {
    if (goal) {
      await update.mutateAsync({
        id: goal.id,
        body: sharedReadonly ? { weightage: values.weightage } : values,
      });
    } else {
      await create.mutateAsync({ sheet_id: sheetId, ...values });
    }
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {goal ? (
          <Button variant="ghost" size="sm">Edit</Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add goal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "Add goal"}</DialogTitle>
          <DialogDescription>
            {sharedReadonly
              ? "This is a shared goal. Only weightage is editable."
              : "Define a measurable goal with target and weightage."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-1">
            <Label>Thrust area</Label>
            <Input disabled={sharedReadonly} {...form.register("thrust_area")} />
            {form.formState.errors.thrust_area && (
              <p className="text-xs text-destructive">{form.formState.errors.thrust_area.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Title</Label>
            <Input disabled={sharedReadonly} {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea rows={2} disabled={sharedReadonly} {...form.register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>UoM type</Label>
              <Select
                disabled={sharedReadonly}
                value={form.watch("uom_type")}
                onValueChange={(v) => form.setValue("uom_type", v as GoalFormValues["uom_type"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UOM_TYPES.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Target</Label>
              <Input type="number" step="0.01" min="0.01" disabled={sharedReadonly} {...form.register("target", { valueAsNumber: true })} />
              {form.formState.errors.target && (
                <p className="text-xs text-destructive">{form.formState.errors.target.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Weightage (%)</Label>
            <Input
              type="number"
              min={GOAL_LIMITS.MIN_WEIGHTAGE}
              max={GOAL_LIMITS.MAX_WEIGHTAGE}
              {...form.register("weightage", { valueAsNumber: true })}
            />
            {form.formState.errors.weightage && (
              <p className="text-xs text-destructive">{form.formState.errors.weightage.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {goal ? "Save" : "Add goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({ onSubmit, pending }: { onSubmit: (c: string) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" /> Return for rework
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return for rework</DialogTitle>
          <DialogDescription>Share feedback so the employee can revise the sheet.</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What needs to change?"
        />
        <DialogFooter>
          <Button
            disabled={!comment.trim() || pending}
            onClick={() => {
              onSubmit(comment.trim());
              setOpen(false);
              setComment("");
            }}
          >
            Send back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareGoalDialog({ goal }: { goal: import("@/types/api").GoalOut }) {
  const [open, setOpen] = useState(false);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const { data: users } = useUsers(true);
  const share = useShareGoal();

  const handleShare = async () => {
    if (!employeeIds.length) return;
    await share.mutateAsync({
      source_goal_id: goal.id,
      employee_ids: employeeIds,
    });
    setOpen(false);
    setEmployeeIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Share2 className="mr-2 h-3 w-3" /> Share</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Goal</DialogTitle>
          <DialogDescription>Assign this goal to other employees (they can only edit weightage).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Target Employees</Label>
            <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
              {users?.map(u => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={employeeIds.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) setEmployeeIds(prev => [...prev, u.id]);
                      else setEmployeeIds(prev => prev.filter(id => id !== u.id));
                    }}
                  />
                  {u.full_name} ({u.email})
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleShare} disabled={!employeeIds.length || share.isPending}>Share</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckinsCard({ sheetId, canPost, windowIsOpen }: { sheetId: string; canPost: boolean; windowIsOpen: boolean }) {
  const { data, isLoading } = useCheckinsBySheet(sheetId);
  const create = useCreateCheckin(sheetId);
  const [quarter, setQuarter] = useState<string>(QUARTERS[0]);
  const [comment, setComment] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Check-ins</CardTitle>
        <CardDescription>Manager comments per quarter.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-16" />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No check-ins yet" />
        ) : (
          <ul className="space-y-2">
            {data.map((c) => (
              <li key={c.id} className="rounded-md border border-border/60 p-3 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="outline">{c.quarter}</Badge>
                  {c.created_at && (
                    <span className="text-xs text-muted-foreground">{c.created_at}</span>
                  )}
                </div>
                <p>{c.comment}</p>
              </li>
            ))}
          </ul>
        )}
        {canPost && (
          <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row">
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger className="sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUARTERS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder={!windowIsOpen ? "Check-in window is closed" : "Add a check-in comment"}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={!windowIsOpen}
            />
            <Button
              disabled={!comment.trim() || create.isPending || !windowIsOpen}
              onClick={() => {
                create.mutate(
                  { sheet_id: sheetId, quarter, comment: comment.trim() },
                  { onSuccess: () => setComment("") },
                );
              }}
            >
              Post
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
