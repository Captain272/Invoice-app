"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Role, UserStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";
import { createUser, updateUser, deleteUser } from "@/server/actions/users";

type Row = {
  id: string; name: string; email: string; role: Role; status: UserStatus;
  lastLoginAt: Date | null; createdAt: Date;
};

const ROLE_OPTIONS: Role[] = ["SUPER_ADMIN", "ADMIN", "STAFF", "VIEWER"];

export function UsersTable({ users, currentUserId }: { users: Row[]; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [isPending, startTransition] = useTransition();

  function onDelete(u: Row) {
    if (u.id === currentUserId) { toast.error("You cannot delete yourself"); return; }
    if (!confirm(`Delete user ${u.email}?`)) return;
    startTransition(async () => {
      try { await deleteUser(u.id); toast.success("User deleted"); }
      catch (e) { toast.error((e as Error).message); }
    });
  }

  return (
    <Card><CardContent className="p-6">
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setOpen(true); }} variant="amber"><Plus className="h-4 w-4" /> Add user</Button>
          </DialogTrigger>
          <UserDialog
            key={editing?.id ?? "new"}
            initial={editing}
            onCancel={() => setOpen(false)}
            onSubmit={async (vals) => {
              try {
                if (editing) await updateUser(editing.id, vals);
                else await createUser(vals);
                toast.success(editing ? "User updated" : "User created");
                setOpen(false);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          />
        </Dialog>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Last login</th>
              <th className="p-3 font-medium">Created</th>
              <th className="p-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/30">
                <td className="p-3 font-medium">{u.name}{u.id === currentUserId && <Badge variant="secondary" className="ml-2">you</Badge>}</td>
                <td className="p-3 text-muted-foreground">{u.email}</td>
                <td className="p-3"><Badge variant={u.role === "SUPER_ADMIN" ? "amber" : "outline"}>{u.role.replace("_", " ").toLowerCase()}</Badge></td>
                <td className="p-3"><Badge variant={u.status === "ACTIVE" ? "success" : "secondary"}>{u.status.toLowerCase()}</Badge></td>
                <td className="p-3 text-muted-foreground">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</td>
                <td className="p-3 text-muted-foreground">{formatDateTime(u.createdAt)}</td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(u); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(u)} disabled={isPending}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent></Card>
  );
}

function UserDialog({
  initial, onCancel, onSubmit,
}: {
  initial: Row | null;
  onCancel: () => void;
  onSubmit: (v: { name: string; email: string; role: Role; status: UserStatus; password?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState<Role>(initial?.role ?? "STAFF");
  const [status, setStatus] = useState<UserStatus>(initial?.status ?? "ACTIVE");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "Edit user" : "Add user"}</DialogTitle>
        <DialogDescription>{initial ? "Leave password blank to keep current password." : "Password must be at least 8 characters."}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" /></div>
        <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" disabled={!!initial} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r.replace("_", " ").toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as UserStatus)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>{initial ? "New password (optional)" : "Password"}</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" placeholder="••••••••" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button
          disabled={submitting || !name || !email || (!initial && password.length < 8)}
          onClick={async () => {
            setSubmitting(true);
            try { await onSubmit({ name, email, role, status, password: password || undefined }); }
            finally { setSubmitting(false); }
          }}
        >
          {submitting ? "Saving…" : initial ? "Save" : "Create user"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
