'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { User, UserRole } from '../../../types/auth';
import {
  Users,
  Plus,
  ShieldCheck,
  UserCheck,
  DollarSign,
  Phone,
  Mail,
  Edit2,
  Lock,
  KeyRound,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { formatCurrency } from '../../../lib/utils';

export default function UsersManagementPage() {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('USER');
  const [hourlyWage, setHourlyWage] = useState('50.0');
  const [chargeOutRate, setChargeOutRate] = useState('125.0');

  useEffect(() => {
    async function loadUsers() {
      const data = await api.getUsers();
      setUsers(data);
    }
    loadUsers();
  }, []);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="h-12 w-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Admin Access Required</h2>
        <p className="text-xs text-slate-400">
          Staff wage rates and user administration are restricted to Business Owners and Office Admins.
        </p>
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setRole('USER');
    setHourlyWage('50.0');
    setChargeOutRate('125.0');
    setIsModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setPassword('');
    setPhone(u.phone || '');
    setRole(u.role);
    setHourlyWage(String(u.hourly_wage || 50));
    setChargeOutRate(String(u.charge_out_rate || 125));
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    if (editingUser) {
      const payload: Partial<User> = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
        hourly_wage: Number(hourlyWage) || 50,
        charge_out_rate: Number(chargeOutRate) || 125,
      };
      if (password.trim()) {
        payload.password = password.trim();
      }

      const updated = await api.updateUser(editingUser.id, payload);
      if (updated) {
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      }
    } else {
      const created = await api.createUser({
        name: name.trim(),
        email: email.trim(),
        password: password.trim() || undefined,
        phone: phone.trim(),
        role,
        business_id: user?.business_id || '',
        business_name: user?.business_name || '',
        hourly_wage: Number(hourlyWage) || 50,
        charge_out_rate: Number(chargeOutRate) || 125,
        active: true,
      });
      setUsers((prev) => [...prev, created]);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Users className="h-6 w-6 text-sky-400" />
            Staff
          </h2>
          {/* <p className="text-xs sm:text-sm text-slate-400">
            Configure tradie profiles, business hourly wage cost, and billable charge-out rates. Passwords are saved with PBKDF2 encryption.
          </p> */}
        </div>

        <Button
          size="sm"
          onClick={openCreateModal}
          className="bg-sky-500 hover:bg-sky-600 text-xs font-semibold gap-1.5 shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Team Member
        </Button>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Hourly Wage (Cost)</TableHead>
              <TableHead>Charge-Out Rate (Billable)</TableHead>
              <TableHead>Target Margin</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                  No staff members registered yet. Click &quot;Add Team Member&quot; to provision user accounts.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const cost = u.hourly_wage || 0;
                const charge = u.charge_out_rate || 0;
                const margin = charge > 0 ? (((charge - cost) / charge) * 100).toFixed(1) : '0';

                return (
                  <TableRow key={u.id} className="hover:bg-slate-800/40">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-sky-400">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-200 text-xs">{u.name}</p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {u.email}
                            </span>
                            {u.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {u.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'} className="text-[10px]">
                        {u.role === 'ADMIN' ? (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            ADMIN
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <UserCheck className="h-3 w-3" />
                            TRADIE
                          </span>
                        )}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <span className="font-semibold text-xs text-slate-300">
                        {formatCurrency(cost)}/hr
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="font-semibold text-xs text-sky-400">
                        {formatCurrency(charge)}/hr
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge variant="purple" className="text-[10px]">
                        {margin}% Margin
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant={u.active ? 'success' : 'secondary'} className="text-[10px]">
                        {u.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(u)}
                        className="h-8 px-2 text-xs text-slate-400 hover:text-slate-100 cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit User Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingUser ? 'Edit Staff Member' : 'Add Team Member'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Set role permissions and wage rates. Password is automatically encrypted.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Full Name *</Label>
              <Input
                id="u-name"
                placeholder="e.g. Dave Miller"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-slate-950 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="u-email">Email Address *</Label>
                <Input
                  id="u-email"
                  type="email"
                  placeholder="technician@company.com.au"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-slate-950 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-phone">Phone Number</Label>
                <Input
                  id="u-phone"
                  placeholder="+61 400 000 000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-slate-950 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-password">
                {editingUser ? 'Reset Password (Leave blank to keep unchanged)' : 'Account Password *'}
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  id="u-password"
                  type="password"
                  placeholder={editingUser ? '••••••••••••' : 'Enter account password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!editingUser}
                  className="pl-9 bg-slate-950 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Access Role</Label>
              <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
                <SelectTrigger className="bg-slate-950 text-xs">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 text-xs">
                  <SelectItem value="USER">USER (Field Tradie - Mobile App)</SelectItem>
                  <SelectItem value="ADMIN">ADMIN (Office Staff - Full ERP Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="space-y-1.5">
                <Label htmlFor="wage">Hourly Wage Cost ($ AUD)</Label>
                <Input
                  id="wage"
                  type="number"
                  value={hourlyWage}
                  onChange={(e) => setHourlyWage(e.target.value)}
                  className="bg-slate-900 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="charge">Billable Charge-Out Rate</Label>
                <Input
                  id="charge"
                  type="number"
                  value={chargeOutRate}
                  onChange={(e) => setChargeOutRate(e.target.value)}
                  className="bg-slate-900 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="bg-sky-500 hover:bg-sky-600 font-semibold text-xs cursor-pointer">
                {editingUser ? 'Save Changes' : 'Create Staff Member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
