'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Project, ProjectStatus } from '../../types/project';
import { User } from '../../types/auth';
import { api } from '../../lib/api';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAbn, setClientAbn] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [assignedTradie, setAssignedTradie] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('IN_PROGRESS');
  const [estimatedHours, setEstimatedHours] = useState('40');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadUsers() {
      try {
        const liveUsers = await api.getUsers();
        setUsers(liveUsers);
        if (liveUsers.length > 0) {
          setAssignedTradie(liveUsers[0].id);
        }
      } catch {}
    }
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !clientName.trim() || !siteAddress.trim()) return;

    setIsSubmitting(true);
    try {
      const selectedUser = users.find((u) => u.id === assignedTradie);
      await onSubmit({
        business_id: '',
        name: name.trim(),
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || undefined,
        client_phone: clientPhone.trim() || undefined,
        client_abn: clientAbn.trim() || undefined,
        site_address: siteAddress.trim(),
        status,
        assigned_user_ids: assignedTradie ? [assignedTradie] : [],
        assigned_user_names: selectedUser ? [selectedUser.name] : [],
        estimated_hours: Number(estimatedHours) || 40,
        logged_hours: 0,
      });

      // Reset form
      setName('');
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setClientAbn('');
      setSiteAddress('');
      setStatus('IN_PROGRESS');
      setEstimatedHours('40');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Create New Job Project</DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Provision a new trade site project. Field voice notes from mobile will bind to this project automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="proj-name">Project / Site Name *</Label>
              <Input
                id="proj-name"
                placeholder="e.g. Commercial Irrigation Upgrade - Stage 2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-slate-950"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-name">Client / Principal Name *</Label>
              <Input
                id="client-name"
                placeholder="e.g. Mornington Golf Club"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                className="bg-slate-950"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-abn">Client ABN (Optional)</Label>
              <Input
                id="client-abn"
                placeholder="e.g. 51 123 456 789"
                value={clientAbn}
                onChange={(e) => setClientAbn(e.target.value)}
                className="bg-slate-950"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-email">Client Contact Email</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="accounts@client.com.au"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="bg-slate-950"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-phone">Site Supervisor Phone</Label>
              <Input
                id="client-phone"
                placeholder="+61 400 000 000"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="bg-slate-950"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="site-address">Site Location / Address *</Label>
            <Input
              id="site-address"
              placeholder="e.g. 100 Industrial Road, Mornington VIC 3931"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              required
              className="bg-slate-950"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Assigned Lead Tradie</Label>
              <Select value={assignedTradie} onValueChange={setAssignedTradie}>
                <SelectTrigger className="bg-slate-950">
                  <SelectValue placeholder="Select tradie" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                  {users.length === 0 && (
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Project Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as ProjectStatus)}>
                <SelectTrigger className="bg-slate-950">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                  <SelectItem value="PENDING">Pending Approval</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="est-hours">Estimated Labor (Hrs)</Label>
              <Input
                id="est-hours"
                type="number"
                min="0"
                step="0.5"
                placeholder="40"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="bg-slate-950"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-sky-500 hover:bg-sky-600 font-semibold text-xs"
            >
              {isSubmitting ? 'Creating Project...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
