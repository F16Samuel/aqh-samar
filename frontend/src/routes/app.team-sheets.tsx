import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useTeamGoalSheets, useUsers } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Search, ArrowRight, UserCheck, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SheetStatusBadge } from "@/components/goals/SheetStatusBadge";

export const Route = createFileRoute("/app/team-sheets")({
  component: TeamSheetsPage,
});

function TeamSheetsPage() {
  const me = useAuthStore((s) => s.profile);
  if (!me) return null;
  
  // Guard the route: only managers and admins can access Team Sheets
  if (me.role !== "manager" && me.role !== "admin") {
    return <Navigate to="/app/" />;
  }

  // Parse custom query parameter employee_id from window location search safely
  const searchParams = new URLSearchParams(window.location.search);
  const employeeIdParam = searchParams.get("employee_id");

  const { data: teamSheets, isLoading: loadingTeam } = useTeamGoalSheets(true);
  const { data: users } = useUsers(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(employeeIdParam);

  // Sync selectedEmployeeId if search parameter changes in the window
  useEffect(() => {
    setSelectedEmployeeId(employeeIdParam);
  }, [employeeIdParam]);

  const clearEmployeeFilter = () => {
    setSelectedEmployeeId(null);
    // Safely update window url query param without full page reload
    const url = new URL(window.location.href);
    url.searchParams.delete("employee_id");
    window.history.pushState({}, "", url.toString());
  };

  const filteredSheets = (teamSheets ?? [])
    .filter((sheet) => {
      // 1. Filter by employee_id if selected
      if (selectedEmployeeId && sheet.employee_id !== selectedEmployeeId) {
        return false;
      }
      
      // Get associated user info for role/title search
      const user = users?.find((u) => u.id === sheet.employee_id);
      const jobTitle = user?.job_title?.toLowerCase() ?? "";
      const platformRole = user?.platform_role?.toLowerCase() ?? "";
      const empName = sheet.employee_name?.toLowerCase() ?? "";
      const sheetIdHex = sheet.id.toLowerCase();
      
      // 2. Filter by status dropdown
      if (statusFilter !== "all" && sheet.status !== statusFilter) {
        return false;
      }

      // 3. Filter by search input (Name, Job Title, Role, Sheet ID, Status)
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        empName.includes(q) ||
        jobTitle.includes(q) ||
        platformRole.includes(q) ||
        sheet.status.toLowerCase().includes(q) ||
        sheetIdHex.includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "name-asc") {
        return a.employee_name.localeCompare(b.employee_name);
      }
      if (sortBy === "name-desc") {
        return b.employee_name.localeCompare(a.employee_name);
      }
      if (sortBy === "status") {
        return a.status.localeCompare(b.status);
      }
      if (sortBy === "id") {
        return a.id.localeCompare(b.id);
      }
      return 0;
    });

  // Find user name for filter banner
  const filteredEmployeeName = users?.find((u) => u.id === selectedEmployeeId)?.full_name ?? "Selected Employee";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Team Goal Sheets</h1>
        <p className="text-sm text-muted-foreground">
          Track and review goal sheets submitted by employees across your department.
        </p>
      </header>

      {selectedEmployeeId && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            <span>
              Showing sheets exclusively for <strong className="font-semibold text-primary">{filteredEmployeeName}</strong>
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={clearEmployeeFilter} className="h-7 px-2 text-muted-foreground hover:text-foreground">
            <X className="mr-1 h-3.5 w-3.5" /> Clear Filter
          </Button>
        </div>
      )}

      {/* Filter strip */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Search Sheets</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <input
                  type="text"
                  placeholder="Search by name, job title, platform role, status, or sheet ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-sm pl-9 pr-3 py-2 bg-background border border-border/60 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full text-sm bg-background border-border/60">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rework">Rework</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sort By</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full text-sm bg-background border-border/60">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Employee Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Employee Name (Z-A)</SelectItem>
                  <SelectItem value="status">Sheet Status</SelectItem>
                  <SelectItem value="id">Sheet ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200/50 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader>
          <CardTitle className="text-base text-amber-600 dark:text-amber-400">Team Goal Sheets Directory</CardTitle>
          <CardDescription>Click review to unlock goals, add comments, or return sheets for rework.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTeam ? (
            <Skeleton className="h-32 w-full" />
          ) : !filteredSheets || filteredSheets.length === 0 ? (
            <EmptyState title="No goal sheets found" description="No team sheets match the current search filters." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Platform Role & Job Title</TableHead>
                  <TableHead>Sheet ID</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSheets.map((s) => {
                  const empUser = users?.find((u) => u.id === s.employee_id);
                  const jobTitle = empUser?.job_title;
                  const platformRole = empUser?.platform_role;
                  
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold">{s.employee_name}</span>
                          {empUser?.email && <span className="text-xs text-muted-foreground">{empUser.email}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {jobTitle && <span className="text-sm font-medium">{jobTitle}</span>}
                          {platformRole && (
                            <span className="capitalize text-[10px] text-muted-foreground w-max px-1.5 py-0.2 bg-muted/80 rounded-sm">
                              {platformRole}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{s.id.slice(0, 4).toUpperCase()}
                      </TableCell>
                      <TableCell>{s.cycle_label}</TableCell>
                      <TableCell>
                        <SheetStatusBadge status={s.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          to="/app/goal-sheets/$sheetId"
                          params={{ sheetId: s.id }}
                          className="inline-flex items-center gap-1 text-sm text-primary"
                        >
                          Review <ArrowRight className="h-3 w-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
