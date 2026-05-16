import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/store/auth.store";
import { useCycles, useCreateCycle, useUpdateCycle } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cycleFormSchema, type CycleFormValues } from "@/schemas/forms";
import { Plus, Unlock } from "lucide-react";
import { format, addDays, subDays } from "date-fns";

export const Route = createFileRoute("/app/admin/cycles")({
  component: CyclesPage,
});

function CyclesPage() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  if (me.role !== "admin") return <Navigate to="/app" />;
  const { data, isLoading } = useCycles();
  const update = useUpdateCycle();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cycles</h1>
          <p className="text-sm text-muted-foreground">Manage performance cycles and quarterly windows.</p>
        </div>
        <NewCycleDialog />
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All cycles</CardTitle>
          <CardDescription>From /cycles</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : !data?.length ? <EmptyState title="No cycles yet" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead>Close</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.year}</TableCell>
                    <TableCell>{c.phase}</TableCell>
                    <TableCell>{c.window_open}</TableCell>
                    <TableCell>{c.window_close}</TableCell>
                    <TableCell>
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={(v) => update.mutate({ id: c.id, body: { is_active: v } })}
                      />
                      {c.is_active && <Badge className="ml-2">Active</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={update.isPending}
                        onClick={() => {
                          const today = new Date();
                          update.mutate({
                            id: c.id,
                            body: {
                              window_open: format(subDays(today, 1), "yyyy-MM-dd"),
                              window_close: format(addDays(today, 30), "yyyy-MM-dd"),
                            },
                          });
                        }}
                      >
                        <Unlock className="mr-2 h-3 w-3" /> Force Open
                      </Button>
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

function NewCycleDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateCycle();
  const form = useForm<CycleFormValues>({
    resolver: zodResolver(cycleFormSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      phase: "Goal Setting",
      window_open: "",
      window_close: "",
      is_active: false,
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> New cycle</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create cycle</DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit(async (v) => {
            await create.mutateAsync(v);
            setOpen(false);
            form.reset();
          })}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Year</Label>
              <Input type="number" {...form.register("year", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <Label>Phase</Label>
              <Input {...form.register("phase")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Window open</Label>
              <Input type="date" {...form.register("window_open")} />
            </div>
            <div className="space-y-1">
              <Label>Window close</Label>
              <Input type="date" {...form.register("window_close")} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.watch("is_active")} onCheckedChange={(v) => form.setValue("is_active", v)} />
            <Label>Active</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
