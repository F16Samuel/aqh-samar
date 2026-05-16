export const qk = {
  me: ["auth", "me"] as const,
  users: {
    all: ["users"] as const,
    list: () => ["users", "list"] as const,
    detail: (id: string) => ["users", "detail", id] as const,
    team: (id: string) => ["users", "team", id] as const,
  },
  cycles: {
    all: ["cycles"] as const,
    active: ["cycles", "active"] as const,
    list: () => ["cycles", "list"] as const,
  },
  goalSheets: {
    all: ["goal-sheets"] as const,
    mine: ["goal-sheets", "mine"] as const,
    team: ["goal-sheets", "team"] as const,
    detail: (id: string) => ["goal-sheets", "detail", id] as const,
  },
  goals: {
    all: ["goals"] as const,
    bySheet: (sheetId: string) => ["goals", "sheet", sheetId] as const,
  },
  achievements: {
    all: ["achievements"] as const,
    byGoal: (goalId: string) => ["achievements", "goal", goalId] as const,
  },
  checkins: {
    bySheet: (sheetId: string) => ["checkins", "sheet", sheetId] as const,
  },
  reports: {
    completion: (params: Record<string, unknown>) => ["reports", "completion", params] as const,
  },
  admin: {
    escalations: ["admin", "escalations"] as const,
  },
} as const;
