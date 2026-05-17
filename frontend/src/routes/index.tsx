import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/auth.store";
import { useMe } from "@/hooks/api";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  component: RoleHome,
});

function RoleHome() {
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const session = useAuthStore((s) => s.session);

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Skeleton className="h-16 w-64" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" />;
  return <RedirectByRole />;
}

function RedirectByRole() {
  const { data: me, isLoading, error } = useMe();
  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-16 w-64" />
      </div>
    );
  if (error || !me) return <Navigate to="/login" />;
  return <Navigate to="/app/" />;
}
