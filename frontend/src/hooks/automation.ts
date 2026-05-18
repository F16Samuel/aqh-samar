import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { http, request } from "@/api/httpClient";
import { toast } from "sonner";
import { errorMessage } from "@/utils/errors";

const onErr = (e: unknown) => toast.error(errorMessage(e));

export interface AutomationRuleOut {
  id: string;
  name: string;
  description?: string;
  trigger_type: string;
  conditions: Record<string, any>;
  actions: Array<Record<string, any>>;
  is_active: boolean;
  created_at: string;
}

export interface AutomationHistoryOut {
  id: string;
  rule_name: string;
  action_type: string;
  recipient_name: string;
  recipient_email: string;
  status: string;
  details?: string;
  executed_at: string;
}

export interface MockNotificationOut {
  id: string;
  type: string;
  sender_name: string;
  recipient_name: string;
  recipient_email: string;
  sender_email?: string;
  subject?: string;
  body: string;
  status: string;
  folder: string;
  interactive_payload?: Record<string, any>;
  created_at: string;
}

export const useAutomationRules = () =>
  useQuery<AutomationRuleOut[]>({
    queryKey: ["automation", "rules"],
    queryFn: () => http.get<AutomationRuleOut[]>("/automation/rules"),
    staleTime: 10_000,
  });

export const useCreateAutomationRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<AutomationRuleOut>) => http.post("/automation/rules", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation", "rules"] });
      toast.success("Automation rule created successfully!");
    },
    onError: onErr,
  });
};

export const useUpdateAutomationRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AutomationRuleOut> }) =>
      request(`/automation/rules/${id}`, { method: "PUT", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation", "rules"] });
      toast.success("Automation rule updated!");
    },
    onError: onErr,
  });
};

export const useDeleteAutomationRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http.del(`/automation/rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation", "rules"] });
      toast.success("Automation rule deleted.");
    },
    onError: onErr,
  });
};

export const useAutomationHistory = () =>
  useQuery<AutomationHistoryOut[]>({
    queryKey: ["automation", "history"],
    queryFn: () => http.get<AutomationHistoryOut[]>("/automation/history"),
    staleTime: 5000,
  });

export const useAutomationAnalytics = () =>
  useQuery<any>({
    queryKey: ["automation", "analytics"],
    queryFn: () => http.get<any>("/automation/analytics"),
    staleTime: 10_000,
  });

export const useMockNotifications = (email?: string) =>
  useQuery<MockNotificationOut[]>({
    queryKey: ["automation", "notifications", email || "all"],
    queryFn: () =>
      http.get<MockNotificationOut[]>("/automation/notifications", {
        query: email ? { recipient_email: email } : {},
      }),
    staleTime: 3000,
    refetchInterval: 5000, // Refresh every 5s for real-time mailbox simulation
  });

export const useMarkNotifRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http.post(`/automation/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation", "notifications"] });
    },
  });
};

export const useMoveNotificationFolder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, folder }: { id: string; folder: string }) =>
      request(`/automation/notifications/${id}/folder`, { method: "PUT", body: { folder } }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["automation", "notifications"] });
    },
    onError: onErr,
  });
};

export const useComposeNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      sender_email: string;
      recipient_email: string;
      subject?: string;
      body: string;
      type: string;
    }) => http.post("/automation/notifications/compose", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation", "notifications"] });
      toast.success("Notification sent successfully!");
    },
    onError: onErr,
  });
};

export const useTeamsInteractiveAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { sheet_id: string; action: string; recipient_email: string }) =>
      http.post("/automation/notifications/interactive-action", body),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["automation", "notifications"] });
      qc.invalidateQueries({ queryKey: ["goalSheets"] });
      toast.success(data?.message || "Teams submit action callback completed!");
    },
    onError: onErr,
  });
};

export const useSimulateRule = () =>
  useMutation({
    mutationFn: (body: Partial<AutomationRuleOut>) => http.post<any[]>("/automation/simulate", body),
    onError: onErr,
  });
