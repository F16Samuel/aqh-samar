import { Badge } from "@/components/ui/badge";
import type { SheetStatus } from "@/types/api";

export function SheetStatusBadge({ status }: { status: SheetStatus }) {
  const s = String(status || "").toLowerCase();
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
    draft: { label: "Draft", variant: "outline" },
    submitted: { label: "Submitted", variant: "secondary" },
    approved: { label: "Approved", variant: "default", className: "bg-emerald-600 hover:bg-emerald-600" },
    returned: { label: "Returned", variant: "destructive" },
    locked: { label: "Locked", variant: "default" },
  };
  const cfg = map[s] ?? { label: status || "—", variant: "outline" as const };
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
