import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useUsers, useUpdateUser, useCreateProfile, useDepartments } from "@/hooks/api";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UserOut, Role, UserCreate } from "@/types/api";

// DEPARTMENTS array removed - using useDepartments hook instead

export const Route = createFileRoute("/app/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const me = useAuthStore((s) => s.profile);
  const isAdmin = me?.role === "admin";
  
  const { data: users, isLoading } = useUsers(isAdmin);
  const { data: depts } = useDepartments(isAdmin);

  if (!me) return null;
  if (!isAdmin) return <Navigate to="/app" />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage organization hierarchy and roles.</p>
        </div>
        <NewUserDialog users={users ?? []} />
      </header>
      
      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="managers">Managers ({users?.filter(u => u.role === "manager").length ?? 0})</TabsTrigger>
          <TabsTrigger value="employees">Employees ({users?.filter(u => u.role === "employee").length ?? 0})</TabsTrigger>
          <TabsTrigger value="admins">Admins/HR ({users?.filter(u => u.role === "admin").length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="managers">
          <UserTable users={users?.filter(u => u.role === "manager") ?? []} allUsers={users ?? []} isLoading={isLoading} title="Managers" />
        </TabsContent>
        <TabsContent value="employees">
          <UserTable users={users?.filter(u => u.role === "employee") ?? []} allUsers={users ?? []} isLoading={isLoading} title="Employees" />
        </TabsContent>
        <TabsContent value="admins">
          <UserTable users={users?.filter(u => u.role === "admin") ?? []} allUsers={users ?? []} isLoading={isLoading} title="Admins/HR" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserTable({ users, allUsers, isLoading, title }: { users: UserOut[]; allUsers: UserOut[]; isLoading: boolean; title: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>View and manage {title.toLowerCase()} accounts.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="max-h-[380px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>{u.department_name || "-"}</TableCell>
                    <TableCell>{u.manager_name || "-"}</TableCell>
                    <TableCell className="text-right">
                      <UserEditDialog user={u} users={allUsers} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UserEditDialog({ user, users }: { user: UserOut; users: UserOut[] }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  const [managerId, setManagerId] = useState<string>(user.manager_id || "none");
  const [departmentId, setDepartmentId] = useState<string>(user.department_id || "none");
  const { data: depts } = useDepartments();
  const update = useUpdateUser();

  const handleSave = async () => {
    await update.mutateAsync({
      id: user.id,
      body: {
        role,
        manager_id: managerId === "none" ? null : managerId,
        department_id: departmentId === "none" ? null : departmentId,
      },
    });
    setOpen(false);
  };

  const potentialManagers = users.filter((u) => u.id !== user.id && (u.role === "manager" || u.role === "admin"));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User: {user.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Department</SelectItem>
                {depts?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Manager</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Manager</SelectItem>
                {potentialManagers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name} ({m.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={update.isPending}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewUserDialog({ users }: { users: UserOut[] }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [managerId, setManagerId] = useState<string>("none");
  const [departmentId, setDepartmentId] = useState<string>("none");
  const { data: depts } = useDepartments();
  const create = useCreateProfile();

  const handleCreate = async () => {
    if (!email.trim() || !fullName.trim()) return;
    await create.mutateAsync({
      email: email.trim(),
      full_name: fullName.trim(),
      role,
      manager_id: managerId === "none" ? null : managerId,
      department_id: departmentId === "none" ? null : departmentId,
    });
    setOpen(false);
    setEmail("");
    setFullName("");
  };

  const potentialManagers = users.filter((u) => u.role === "manager" || u.role === "admin");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> New User Profile</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create User Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Temporary Password (Demo)</Label>
            <Input type="text" value="ChangeMe123!" disabled />
            <p className="text-xs text-muted-foreground">User must sign up via Supabase using the email above.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {depts?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Manager</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Manager</SelectItem>
                {potentialManagers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={create.isPending || !email.trim() || !fullName.trim()}>
            Create Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
