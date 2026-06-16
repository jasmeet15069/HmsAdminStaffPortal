import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Stat } from "@/components/AppShell";
import { useMHMS } from "@/lib/mhms-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const PERMS = [
  { mod: "Reservations", roles: ["Admin","Manager","Front Desk"] },
  { mod: "Front Desk", roles: ["Admin","Manager","Front Desk"] },
  { mod: "Housekeeping", roles: ["Admin","Manager","Housekeeping"] },
  { mod: "Billing", roles: ["Admin","Manager","Accounts"] },
  { mod: "Inventory", roles: ["Admin","Manager"] },
  { mod: "POS", roles: ["Admin","Manager","F&B"] },
  { mod: "Procurement", roles: ["Admin","Manager"] },
  { mod: "Maintenance", roles: ["Admin","Manager"] },
  { mod: "Reports", roles: ["Admin","Manager"] },
  { mod: "User Management", roles: ["Admin"] },
];

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "Users & Roles · MHMS" }] }),
  component: Users,
});

function Users() {
  const { users, addUser, updateUser } = useMHMS();
  const [open, setOpen] = useState(false);
  const [u, setU] = useState({ name: "", email: "", role: "Front Desk" as const });

  return (
    <>
      <PageHeader title="Users & Roles" description="Access control and permissions" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Add user</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input className="mt-1" value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input className="mt-1" type="email" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} /></div>
              <div><Label>Role</Label>
                <Select value={u.role} onValueChange={(v) => setU({ ...u, role: v as never })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Admin","Manager","Front Desk","Housekeeping","Accounts","F&B"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => { addUser({ ...u, active: true, lastLogin: new Date().toISOString().slice(0,10) }); setOpen(false); toast.success("User created · invitation sent"); }}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Total Users" value={users.length} />
        <Stat label="Active" value={users.filter(u => u.active).length} tone="success" />
        <Stat label="Roles" value={new Set(users.map(u => u.role)).size} />
        <Stat label="Admins" value={users.filter(u => u.role === "Admin").length} tone="warning" />
      </div>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="perms">Permissions Matrix</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Last Login</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8"><AvatarFallback className="text-xs">{u.name.split(" ").map(s=>s[0]).join("")}</AvatarFallback></Avatar>
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.lastLogin}</TableCell>
                    <TableCell><Switch checked={u.active} onCheckedChange={(v) => { updateUser(u.id, { active: v }); toast.success(`${u.name} ${v ? "activated" : "deactivated"}`); }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="perms">
          <Card className="p-4 mt-4">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Module</TableHead>
                {["Admin","Manager","Front Desk","Housekeeping","Accounts","F&B"].map(r => <TableHead key={r}>{r}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {PERMS.map(p => (
                  <TableRow key={p.mod}>
                    <TableCell className="font-medium">{p.mod}</TableCell>
                    {["Admin","Manager","Front Desk","Housekeeping","Accounts","F&B"].map(r => (
                      <TableCell key={r}>{p.roles.includes(r) ? <Badge className="bg-success/15 text-success border-success/30" variant="outline">Allow</Badge> : <Badge variant="outline" className="text-muted-foreground">—</Badge>}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
