import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import {
  useAutomationRules,
  useCreateAutomationRule,
  useUpdateAutomationRule,
  useDeleteAutomationRule,
  useSimulateRule,
} from "@/hooks/automation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  Cpu,
  Plus,
  Play,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Clock,
  Mail,
  MessageSquare,
  Shield,
  RotateCcw,
  Sparkles,
  GitBranch,
  Search,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/automation")({
  component: AutomationRuleBuilderPage,
});

const TRIGGER_LABELS: Record<string, string> = {
  overdue_submission: "Overdue Draft Submission",
  pending_approval: "Goal Sheet Pending Approval",
  low_completion: "Low Completion Rate Score",
  missing_checkin: "Missing Quarterly Check-in",
  inactivity: "Employee Inactivity Detection",
  declining_performance: "QoQ Performance Drop Warning",
};

const ACTION_ICONS: Record<string, any> = {
  email: Mail,
  teams: MessageSquare,
  manager_escalation: Shield,
  hr_escalation: Shield,
  workflow_reassignment: RotateCcw,
};

const ACTION_LABELS: Record<string, string> = {
  email: "Send Email Notification",
  teams: "Send MS Teams Card",
  manager_escalation: "Escalate to Skip-Level Manager",
  hr_escalation: "HR Partner Escalation",
  workflow_reassignment: "Automatic Review Reassignment",
};

function AutomationRuleBuilderPage() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  if (me.role !== "admin") return <Navigate to="/app" />;

  const { data: rules, isLoading, refetch } = useAutomationRules();
  const createMutation = useCreateAutomationRule();
  const updateMutation = useUpdateAutomationRule();
  const deleteMutation = useDeleteAutomationRule();
  const simulateMutation = useSimulateRule();

  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<any[] | null>(null);
  const [simulatingRuleName, setSimulatingRuleName] = useState<string | null>(null);

  // New Rule Form State
  const [ruleName, setRuleName] = useState("");
  const [ruleDesc, setRuleDesc] = useState("");
  const [triggerType, setTriggerType] = useState("overdue_submission");
  const [conditionValue, setConditionValue] = useState("5");
  const [actionsList, setActionsList] = useState<any[]>([
    { delay_days: 0, type: "email", recipient: "employee", body: "Warning details..." },
  ]);

  const selectedRule = rules?.find((r) => r.id === selectedRuleId) || rules?.[0];

  const handleToggleActive = (id: string, active: boolean) => {
    updateMutation.mutate({ id, body: { is_active: !active } });
  };

  const handleRunSimulation = (rule: any) => {
    setSimulatingRuleName(rule.name);
    setSimulationLogs(null);
    simulateMutation.mutate(rule, {
      onSuccess: (data) => {
        setSimulationLogs(data);
      },
    });
  };

  const handleDeleteRule = (id: string) => {
    if (confirm("Are you sure you want to delete this automation rule?")) {
      deleteMutation.mutate(id);
      setSelectedRuleId(null);
    }
  };

  const handleAddActionStep = () => {
    setActionsList([...actionsList, { delay_days: 3, type: "teams", body: "Escalated details..." }]);
  };

  const handleRemoveActionStep = (idx: number) => {
    setActionsList(actionsList.filter((_, i) => i !== idx));
  };

  const handleActionChange = (idx: number, field: string, val: any) => {
    const updated = [...actionsList];
    updated[idx] = { ...updated[idx], [field]: val };
    setActionsList(updated);
  };

  const handleSaveNewRule = () => {
    if (!ruleName) {
      toast.error("Please enter a rule name.");
      return;
    }
    
    // Parse conditions
    const conditions: Record<string, any> = {};
    if (triggerType === "overdue_submission" || triggerType === "pending_approval") {
      conditions.days_overdue = parseInt(conditionValue, 10) || 5;
    } else if (triggerType === "declining_performance" || triggerType === "low_completion") {
      conditions.threshold_percent = parseInt(conditionValue, 10) || 15;
    } else if (triggerType === "inactivity") {
      conditions.days_inactive = parseInt(conditionValue, 10) || 10;
    }

    createMutation.mutate(
      {
        name: ruleName,
        description: ruleDesc,
        trigger_type: triggerType,
        conditions,
        actions: actionsList,
        is_active: true,
      },
      {
        onSuccess: () => {
          setShowCreateForm(false);
          setRuleName("");
          setRuleDesc("");
          setActionsList([{ delay_days: 0, type: "email", recipient: "employee", body: "Warning details..." }]);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Cpu className="h-6 w-6 text-primary" /> Visual SLA Escalation & Automation
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure automated compliance checks, multi-level manager reminders, and skip-level reassignments.
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} className="gap-2">
          <Plus className="h-4 w-4" /> {showCreateForm ? "View Active Rules" : "Add Custom Rule"}
        </Button>
      </header>

      {/* Main Form/Grid */}
      {showCreateForm ? (
        /* =========================================================================
           CUSTOM RULE CREATOR FORM
           ========================================================================= */
        <Card className="max-w-4xl mx-auto border-2 border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" /> Create Workflow Escalation Rule
            </CardTitle>
            <CardDescription>Assemble condition triggers and sequential action timelines.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Goal Sheet Submission Warning"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <input
                  type="text"
                  placeholder="Summarize the action trigger purpose"
                  value={ruleDesc}
                  onChange={(e) => setRuleDesc(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Breach Condition Trigger</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(TRIGGER_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Trigger Threshold Limit Value:
                </label>
                <input
                  type="number"
                  placeholder="5"
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Measured in days overdue, inactive days, or drop percentage depending on trigger.
                </span>
              </div>
            </div>

            {/* Actions Timeline Sequential block */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <GitBranch className="h-4 w-4 text-primary" /> Sequential Escalation Chain Step Actions
                </span>
                <Button variant="outline" size="sm" onClick={handleAddActionStep} className="h-7 text-xs">
                  + Add Action Step
                </Button>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                {actionsList.map((act, idx) => (
                  <div key={idx} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 relative group">
                    <button
                      onClick={() => handleRemoveActionStep(idx)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Delay (Days from Breach)</label>
                        <input
                          type="number"
                          value={act.delay_days}
                          onChange={(e) => handleActionChange(idx, "delay_days", parseInt(e.target.value, 10))}
                          className="h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Action Channel</label>
                        <select
                          value={act.type}
                          onChange={(e) => handleActionChange(idx, "type", e.target.value)}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                        >
                          <option value="email">Email Notification</option>
                          <option value="teams">MS Teams Adaptive Card</option>
                          <option value="manager_escalation">Manager Escalation (L1)</option>
                          <option value="hr_escalation">HR Escalation (L2)</option>
                          <option value="workflow_reassignment">Auto-Workflow Reassign</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Target Recipient</label>
                        <select
                          value={act.recipient || "employee"}
                          onChange={(e) => handleActionChange(idx, "recipient", e.target.value)}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                        >
                          <option value="employee">Employee</option>
                          <option value="manager">Manager</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Notification Message Template</label>
                      <textarea
                        value={act.body || ""}
                        onChange={(e) => handleActionChange(idx, "body", e.target.value)}
                        placeholder="Warning body details. Supports variables: {employee_name}, {manager_name}, {days_overdue}"
                        className="h-16 w-full rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveNewRule}>Save and Active Rule</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* =========================================================================
           ACTIVE RULES OVERVIEW & FLOW VISUALIZER
           ========================================================================= */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Rules List Panel */}
          <div className="space-y-4 lg:col-span-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground text-left">
              Configured SLA Rules
            </h2>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : !rules?.length ? (
              <EmptyState title="No Rules Configured" description="Add a new custom rule to get started." />
            ) : (
              <div className="space-y-3 text-left">
                {rules.map((rule) => {
                  const isSelected = selectedRule?.id === rule.id;
                  return (
                    <div
                      key={rule.id}
                      onClick={() => {
                        setSelectedRuleId(rule.id);
                        setSimulationLogs(null);
                      }}
                      className={`cursor-pointer rounded-xl border p-4 transition-all shadow-sm duration-200 ${
                        isSelected
                          ? "bg-primary/5 border-primary shadow-primary/5"
                          : rule.is_active
                            ? "bg-card hover:bg-muted/30 border-border/60"
                            : "bg-rose-500/[0.02] hover:bg-rose-500/[0.04] border-rose-200/50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-foreground leading-none">{rule.name}</h3>
                          <Badge variant="outline" className={`text-[10px] py-0 font-mono mt-1 ${
                            rule.is_active ? "bg-muted/40" : "bg-rose-500/10 text-rose-600 border-rose-200/30"
                          }`}>
                            {rule.trigger_type}
                          </Badge>
                        </div>
                        {/* Premium Toggle Slider */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(rule.id, rule.is_active);
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out self-center ${
                            rule.is_active ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              rule.is_active ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{rule.description}</p>
                      
                      <div className="mt-3 flex items-center justify-between border-t pt-2.5">
                        <Button
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRunSimulation(rule);
                          }}
                          className="h-6 text-[10px] text-primary hover:text-primary/80 gap-1 px-1.5"
                        >
                          <Play className="h-3 w-3 fill-primary" /> Simulation Mode
                        </Button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRule(rule.id);
                          }}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Visual flow visualizer Column */}
          <div className="space-y-4 lg:col-span-2">
            {selectedRule ? (
              <div className="space-y-6 text-left">
                {/* Rule Title details */}
                <Card className={selectedRule.is_active ? "" : "border-rose-100 bg-rose-500/[0.01]"}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between border-b pb-4 mb-4">
                      <div>
                        <h2 className="text-lg font-bold text-foreground">{selectedRule.name}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{selectedRule.description}</p>
                      </div>
                      <Badge className={selectedRule.is_active ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-rose-500 text-white hover:bg-rose-600"}>
                        {selectedRule.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </div>

                    {/* Trigger configuration details */}
                    <div className={`rounded-lg p-4 border border-dashed flex items-center gap-3 transition-colors duration-200 ${
                      selectedRule.is_active
                        ? "bg-muted/40 border-border"
                        : "bg-rose-500/10 border-rose-200"
                    }`}>
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                        selectedRule.is_active ? "bg-primary/10 text-primary" : "bg-rose-500/20 text-rose-600"
                      }`}>
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                           Scanner Trigger Conditions
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          Scan active schema for:{" "}
                          <strong className={selectedRule.is_active ? "text-primary" : "text-rose-600"}>
                            {TRIGGER_LABELS[selectedRule.trigger_type]}
                          </strong>
                          {selectedRule.conditions?.days_overdue && (
                            <span> (threshold &gt; {selectedRule.conditions.days_overdue} days overdue)</span>
                          )}
                          {selectedRule.conditions?.threshold_percent && (
                            <span> (threshold &gt; {selectedRule.conditions.threshold_percent}% drop/completion)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Workflow sequential diagram */}
                <Card className={selectedRule.is_active ? "" : "border-rose-100 bg-rose-500/[0.01]"}>
                  <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Sequential Escalation Flowchart
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center space-y-6">
                      {selectedRule.actions.map((act: any, idx: number) => {
                        const Icon = ACTION_ICONS[act.type] || Mail;
                        return (
                          <div key={idx} className="flex flex-col items-center w-full">
                            {/* Step Container Card */}
                            <div className={`flex items-center gap-4 border rounded-xl bg-card p-4 w-full shadow-sm max-w-lg transition-colors relative duration-200 ${
                              selectedRule.is_active
                                ? "border-border/80 hover:border-primary/40"
                                : "border-rose-200/80 bg-rose-500/[0.02] hover:border-rose-300/80"
                            }`}>
                              <span className={`absolute -top-2.5 -left-2.5 h-6 w-6 rounded-full font-bold text-xs flex items-center justify-center shadow-md transition-colors ${
                                selectedRule.is_active
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-rose-500 text-white"
                              }`}>
                                {idx + 1}
                              </span>

                              {/* Action Icon */}
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                                selectedRule.is_active
                                  ? "bg-muted border text-muted-foreground"
                                  : "bg-rose-500/10 border-rose-200 text-rose-600"
                              }`}>
                                <Icon className="h-5 w-5" />
                              </div>

                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs font-semibold uppercase tracking-wide ${
                                    selectedRule.is_active ? "text-primary" : "text-rose-600"
                                  }`}>
                                    Day {act.delay_days} after breach
                                  </span>
                                  <Badge variant="outline" className={`text-[9px] uppercase tracking-wide ${
                                    selectedRule.is_active ? "" : "border-rose-200 text-rose-600 bg-rose-500/[0.04]"
                                  }`}>
                                    {act.type}
                                  </Badge>
                                </div>
                                <h4 className="text-sm font-semibold text-foreground leading-tight">
                                  {ACTION_LABELS[act.type]}
                                </h4>
                                <p className="text-xs text-muted-foreground truncate italic">
                                  "{act.body || "Alert notification dispatched"}"
                                </p>
                              </div>
                            </div>

                            {/* Arrow divider */}
                            {idx < selectedRule.actions.length - 1 && (
                              <div className="flex flex-col items-center my-1">
                                <div className={`h-8 w-0.5 bg-gradient-to-b ${
                                  selectedRule.is_active
                                    ? "from-primary/50 to-muted-foreground/30"
                                    : "from-rose-500/50 to-rose-300/30"
                                }`} />
                                <ChevronRight className={`h-4 w-4 rotate-90 -mt-1 ${
                                  selectedRule.is_active ? "text-muted-foreground/50" : "text-rose-500/50"
                                }`} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Simulation Logs Drawer / Panel */}
                {simulatingRuleName === selectedRule.name && (
                  <Card className="border-2 border-primary/20 shadow-md">
                    <CardHeader className="bg-muted/10 border-b">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                          <Play className="h-3.5 w-3.5 fill-primary text-primary" /> Live Simulation Dry-Run Logs
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSimulationLogs(null)}
                          className="h-6 text-xs text-muted-foreground"
                        >
                          Clear Logs
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      {simulateMutation.isPending ? (
                        <div className="space-y-2 py-4">
                          <Skeleton className="h-6 w-full" />
                          <Skeleton className="h-6 w-full" />
                        </div>
                      ) : !simulationLogs?.length ? (
                        <div className="py-6 text-center text-xs text-muted-foreground">
                          Zero active employees currently matching trigger conditions for rule '{selectedRule.name}'.
                        </div>
                      ) : (
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                          <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                            Found {simulationLogs.length} matching breach candidates:
                          </div>

                          {simulationLogs.map((log: any, idx: number) => (
                            <div
                              key={idx}
                              className="rounded-lg border bg-card p-4 shadow-sm space-y-3 text-xs"
                            >
                              {/* Log Metadata header */}
                              <div className="flex flex-wrap items-center justify-between border-b pb-2 gap-2">
                                <div>
                                  <span className="font-bold text-foreground text-sm">{log.employee_name}</span>
                                  <span className="text-muted-foreground font-mono ml-2">({log.employee_email})</span>
                                </div>
                                <Badge className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 border-none font-medium">
                                  {log.breach_metric}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="font-semibold text-muted-foreground">Direct Manager:</span>{" "}
                                  <span className="text-foreground font-medium">{log.manager_name}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-muted-foreground">Operational Status:</span>{" "}
                                  <Badge variant="outline" className="text-[9px] bg-muted/40 uppercase font-mono">
                                    {log.status}
                                  </Badge>
                                </div>
                              </div>

                              {/* Timeline preview list */}
                              <div className="space-y-2 pt-2 border-t">
                                <span className="font-semibold text-muted-foreground block uppercase text-[9px] tracking-wider">
                                  Simulated Actions Dispatch Timeline:
                                </span>
                                <div className="space-y-1.5">
                                  {log.timeline?.map((step: any, sIdx: number) => (
                                    <div key={sIdx} className="flex items-center justify-between bg-muted/20 rounded px-2.5 py-1">
                                      <span className="font-medium text-foreground">
                                        Step {step.step + 1}: {ACTION_LABELS[step.type]}
                                      </span>
                                      <span className="text-muted-foreground text-[10px] font-mono">
                                        {step.scheduled_at}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <p className="text-sm">Select an automation rule to view flowchart and logs</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
