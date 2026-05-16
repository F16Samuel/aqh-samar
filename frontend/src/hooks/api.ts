import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "./queryKeys";
import { authService } from "@/services/auth.service";
import { usersService } from "@/services/users.service";
import { cyclesService } from "@/services/cycles.service";
import { goalSheetsService } from "@/services/goalSheets.service";
import { goalsService } from "@/services/goals.service";
import { achievementsService } from "@/services/achievements.service";
import { checkinsService } from "@/services/checkins.service";
import { reportsService } from "@/services/reports.service";
import { adminService } from "@/services/admin.service";
import type {
  AchievementCreate,
  AchievementUpdate,
  CheckInCreate,
  CycleCreate,
  CycleUpdate,
  GoalCreate,
  GoalSharedCreate,
  GoalUpdate,
} from "@/types/api";
import { toast } from "sonner";
import { errorMessage } from "@/utils/errors";

const onErr = (e: unknown) => toast.error(errorMessage(e));

export const useMe = () =>
  useQuery({
    queryKey: qk.me,
    queryFn: () => authService.me(),
    staleTime: 10 * 60_000,
    retry: false,
  });

export const useUsers = (enabled = true) =>
  useQuery({ queryKey: qk.users.list(), queryFn: () => usersService.list(), enabled, staleTime: 10 * 60_000 });

export const useTeam = (userId?: string) =>
  useQuery({
    queryKey: userId ? qk.users.team(userId) : ["users", "team", "none"],
    queryFn: () => usersService.team(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });

export const useActiveCycle = () =>
  useQuery({ queryKey: qk.cycles.active, queryFn: () => cyclesService.active(), staleTime: 10 * 60_000, retry: false });

export const useCycles = (enabled = true) =>
  useQuery({ queryKey: qk.cycles.list(), queryFn: () => cyclesService.list(), enabled, staleTime: 10 * 60_000 });

export const useMyGoalSheets = () =>
  useQuery({ queryKey: qk.goalSheets.mine, queryFn: () => goalSheetsService.mine(), staleTime: 30_000 });

export const useGoalsBySheet = (sheetId?: string) =>
  useQuery({
    queryKey: sheetId ? qk.goals.bySheet(sheetId) : ["goals", "sheet", "none"],
    queryFn: () => goalsService.bySheet(sheetId!),
    enabled: !!sheetId,
    staleTime: 30_000,
  });

export const useCheckinsBySheet = (sheetId?: string) =>
  useQuery({
    queryKey: sheetId ? qk.checkins.bySheet(sheetId) : ["checkins", "sheet", "none"],
    queryFn: () => checkinsService.bySheet(sheetId!),
    enabled: !!sheetId,
  });

export const useAchievementsByGoal = (goalId?: string) =>
  useQuery({
    queryKey: goalId ? qk.achievements.byGoal(goalId) : ["achievements", "goal", "none"],
    queryFn: () => achievementsService.byGoal(goalId!),
    enabled: !!goalId,
  });

export const useEscalations = (enabled = true) =>
  useQuery({ queryKey: qk.admin.escalations, queryFn: () => adminService.escalations(), enabled });

export const useAuditLogs = (enabled = true) =>
  useQuery({ queryKey: ["admin", "auditLogs"], queryFn: () => adminService.auditLogs(), enabled });

export const useCompletionReport = (
  params: { cycle_id?: string; quarter?: string } = {},
  enabled = true,
) =>
  useQuery({
    queryKey: qk.reports.completion(params),
    queryFn: () => reportsService.completion(params),
    enabled,
    staleTime: 10 * 60_000,
  });

export const useDepartments = (enabled = true) =>
  useQuery({
    queryKey: ["admin", "departments"],
    queryFn: () => usersService.listDepartments(),
    enabled,
    staleTime: 10 * 60_000,
  });

export const useAllGoalsAdmin = (enabled = true) =>
  useQuery({
    queryKey: ["admin", "allGoals"],
    queryFn: () => goalsService.listAllAdmin(),
    enabled,
    staleTime: 10 * 60_000,
  });

// ----- Mutations -----

export const useCreateSheet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => goalSheetsService.create(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.goalSheets.all });
      toast.success("Draft goal sheet created");
    },
    onError: onErr,
  });
};

export const useSubmitSheet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalSheetsService.submit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.goalSheets.all });
      toast.success("Sheet submitted for review");
    },
    onError: onErr,
  });
};

export const useApproveSheet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalSheetsService.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.goalSheets.all });
      qc.invalidateQueries({ queryKey: qk.goals.all });
      toast.success("Sheet approved");
    },
    onError: onErr,
  });
};

export const useReturnSheet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      goalSheetsService.return(id, { comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.goalSheets.all });
      toast.success("Returned for rework");
    },
    onError: onErr,
  });
};

export const useCreateGoal = (sheetId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GoalCreate) => goalsService.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.goals.bySheet(sheetId) }),
    onError: onErr,
  });
};

export const useUpdateGoal = (sheetId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: GoalUpdate }) => goalsService.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.goals.bySheet(sheetId) }),
    onError: onErr,
  });
};

export const useShareGoal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GoalSharedCreate) => goalsService.share(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.goals.all });
      toast.success("Goal shared with selected employees");
    },
    onError: onErr,
  });
};

export const useCreateAchievement = (goalId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AchievementCreate) => achievementsService.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.achievements.byGoal(goalId) });
      toast.success("Achievement saved");
    },
    onError: onErr,
  });
};

export const useUpdateAchievement = (goalId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AchievementUpdate }) =>
      achievementsService.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.achievements.byGoal(goalId) }),
    onError: onErr,
  });
};

export const useCreateCheckin = (sheetId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CheckInCreate) => checkinsService.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.checkins.bySheet(sheetId) });
      toast.success("Check-in added");
    },
    onError: onErr,
  });
};

export const useCreateCycle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CycleCreate) => cyclesService.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cycles.all });
      toast.success("Cycle created");
    },
    onError: onErr,
  });
};

export const useUpdateCycle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CycleUpdate }) => cyclesService.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cycles.all });
      toast.success("Cycle updated");
    },
    onError: onErr,
  });
};

export const useUnlockGoal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => adminService.unlockGoal(goalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.goals.all });
      toast.success("Goal unlocked");
    },
    onError: onErr,
  });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: import("@/types/api").UserUpdate }) =>
      usersService.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users.list() });
      toast.success("User updated successfully");
    },
    onError: onErr,
  });
};

export const useCreateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: import("@/types/api").UserCreate) => usersService.createProfile(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users.list() });
      toast.success("User profile created. Supabase sign-up required for login.");
    },
    onError: onErr,
  });
};
