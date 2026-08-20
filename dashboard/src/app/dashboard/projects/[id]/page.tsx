'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../context/AuthContext';
import { api } from '../../../../lib/api';
import { Project, VoiceLog } from '../../../../types/project';
import {
  Briefcase,
  ArrowLeft,
  MapPin,
  Clock,
  User,
  Radio,
  FileText,
  Sparkles,
  CheckCircle2,
  Phone,
  Mail,
  Building,
  DollarSign,
  Send,
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/card';
import { VoiceNotePlayer } from '../../../../components/projects/VoiceNotePlayer';
import { formatCurrency, formatDateTime } from '../../../../lib/utils';

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  useEffect(() => {
    async function loadProject() {
      try {
        const data = await api.getProjectById(resolvedParams.id);
        setProject(data);
      } finally {
        setIsLoading(false);
      }
    }
    loadProject();
  }, [resolvedParams.id]);

  const handleApproveMaterial = async (materialId: string, deductInventory: boolean) => {
    if (!project) return;
    const voiceLog = project.voice_logs?.find((l) =>
      l.extracted_materials?.some((m) => m.id === materialId)
    );
    if (!voiceLog) return;

    await api.approveMaterial(project.id, voiceLog.id, materialId, deductInventory);

    // Refresh project state
    const updated = await api.getProjectById(project.id);
    if (updated) setProject(updated);
  };

  const handleGenerateInvoice = async () => {
    if (!project) return;
    setIsGeneratingInvoice(true);
    try {
      const invoice = await api.generateInvoiceFromProject(project.id);
      if (invoice) {
        router.push(`/dashboard/invoices/${invoice.id}`);
      }
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <p className="animate-pulse text-sm">Loading Project Field Data...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-base text-slate-300 font-semibold">Project not found</p>
        <Link href="/dashboard/projects">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  const voiceLogs = project.voice_logs || [];
  const statusNorm = (project.status || 'in progress').toLowerCase().replace('_', ' ');

  return (
    <div className="space-y-6">
      {/* Back Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Projects Hub
        </Link>

        {isAdmin && (
          <Button
            onClick={handleGenerateInvoice}
            disabled={isGeneratingInvoice}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-md cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            {isGeneratingInvoice ? 'Generating Tax Invoice...' : 'Generate ATO Tax Invoice from Project'}
          </Button>
        )}
      </div>

      {/* Project Banner Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  statusNorm === 'in progress'
                    ? 'default'
                    : statusNorm === 'completed'
                    ? 'success'
                    : statusNorm === 'invoiced'
                    ? 'purple'
                    : 'secondary'
                }
                className="text-[11px] capitalize"
              >
                {statusNorm}
              </Badge>
              <span className="text-xs text-slate-500 font-mono">ID: {project.id}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
              {project.name || 'Untitled Project'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                Billable Labor Logged
              </span>
              <span className="text-lg font-bold text-sky-400">
                {project.logged_hours || 0} / {project.estimated_hours || 40} hrs
              </span>
            </div>
          </div>
        </div>

        {/* Client & Site Details Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-xs">
          <div className="space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
              Client Details
            </span>
            <p className="font-bold text-slate-200">{project.client_name || 'Trade Client'}</p>
            {project.client_abn && (
              <p className="text-slate-400">ABN: {project.client_abn}</p>
            )}
            {project.client_phone && (
              <p className="text-slate-400 flex items-center gap-1">
                <Phone className="h-3 w-3 text-sky-400" /> {project.client_phone}
              </p>
            )}
            {project.client_email && (
              <p className="text-slate-400 flex items-center gap-1">
                <Mail className="h-3 w-3 text-sky-400" /> {project.client_email}
              </p>
            )}
          </div>

          <div className="space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
              Site Location
            </span>
            <p className="font-medium text-slate-200 flex items-start gap-1">
              <MapPin className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
              <span>{project.site_address || (project.latitude && project.longitude ? `GPS: ${project.latitude.toFixed(4)}, ${project.longitude.toFixed(4)}` : 'On-Site Location')}</span>
            </p>
            {project.latitude && project.longitude && (
              <p className="text-[10px] font-mono text-slate-500">
                GPS: {project.latitude.toFixed(4)}, {project.longitude.toFixed(4)}
              </p>
            )}
          </div>

          <div className="space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 sm:col-span-2 lg:col-span-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
              Assigned Tradies
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {project.assigned_user_names && project.assigned_user_names.length > 0 ? (
                project.assigned_user_names.map((name, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-[11px]"
                  >
                    <User className="h-3 w-3 text-sky-400" />
                    {name}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 text-xs">Unassigned</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Voice Notes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-purple-400 animate-pulse" />
            <h2 className="text-base font-bold text-slate-100">
              Field Voice Notes from Mobile ({voiceLogs.length})
            </h2>
          </div>
        </div>

        {voiceLogs.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-xs text-slate-500 space-y-1.5">
            <Radio className="h-6 w-6 text-slate-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-400">No field recordings yet for this project</p>
            <p>Voice notes recorded on mobile referencing this job will appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {voiceLogs.map((log) => (
              <VoiceNotePlayer
                key={log.id}
                voiceLog={log}
                onApproveMaterial={handleApproveMaterial}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
