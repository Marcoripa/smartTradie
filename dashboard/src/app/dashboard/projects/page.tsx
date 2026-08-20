'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { Project, ProjectStatus } from '../../../types/project';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Radio,
  MapPin,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { NewProjectModal } from '../../../components/projects/NewProjectModal';

export default function ProjectsListPage() {
  const { isAdmin } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await api.getProjects();
        console.log(data)
        setProjects(data);
      } finally {
        setIsLoading(false);
      }
    }
    loadProjects();
  }, []);

  const handleCreateProject = async (newProjData: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
    const created = await api.createProject(newProjData);
    setProjects((prev) => [created, ...prev]);
  };

  console.log(projects);

  const filteredProjects = projects.filter((p) => {
    const pName = p.name || '';
    const pClient = p.client_name || '';
    const pAddress = p.site_address || (p.latitude && p.longitude ? `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}` : '');
    const q = searchQuery.toLowerCase();

    const matchesSearch =
      pName.toLowerCase().includes(q) ||
      pClient.toLowerCase().includes(q) ||
      pAddress.toLowerCase().includes(q);

    const pStatusNorm = (p.status || 'in progress').toLowerCase().replace('_', ' ');
    const filterNorm = statusFilter.toLowerCase().replace('_', ' ');

    const matchesStatus =
      statusFilter === 'ALL' ||
      pStatusNorm === filterNorm ||
      (filterNorm === 'in progress' && pStatusNorm === 'in progress');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Briefcase className="h-6 w-6 text-sky-400" />
            Projects
          </h2>
        </div>

        {isAdmin && (
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-sky-500 hover:bg-sky-600 gap-1.5 text-xs font-semibold shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search projects, clients, or addresses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-950 text-xs"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {['ALL', 'IN_PROGRESS', 'PENDING', 'COMPLETED', 'INVOICED'].map((status) => {
            const isSelected = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-sky-500 text-white font-semibold shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProjects.map((project) => {
          const voiceCount = project.voice_logs?.length || 0;
          const statusNorm = (project.status || 'in progress').toLowerCase().replace('_', ' ');

          return (
            <Card
              key={project.id}
              className="hover:border-sky-500/40 transition-all flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1">
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
                        className="text-[10px] capitalize"
                      >
                        {statusNorm}
                      </Badge>
                      {voiceCount > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 font-semibold">
                          <Radio className="h-2.5 w-2.5" />
                          {voiceCount} Voice {voiceCount === 1 ? 'Log' : 'Logs'}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-base text-slate-100 mt-1.5">
                      {project.name || 'Untitled Project'}
                    </CardTitle>
                    <p className="text-xs font-medium text-slate-400">
                      Client: <strong className="text-slate-300">{project.client_name || 'Trade Client'}</strong>
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="flex items-start gap-1.5 text-xs text-slate-400">
                  <MapPin className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-1">
                    {project.site_address || (project.latitude && project.longitude ? `GPS: ${project.latitude.toFixed(4)}, ${project.longitude.toFixed(4)}` : 'On-Site Location')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                      Labor Logged
                    </span>
                    <span className="font-bold text-slate-200 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3.5 w-3.5 text-sky-400" />
                      {project.logged_hours || 0} / {project.estimated_hours || 40} hrs
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                      Assigned Crew
                    </span>
                    <span className="font-medium text-slate-300 truncate block mt-0.5">
                      {project.assigned_user_names && project.assigned_user_names.length > 0
                        ? project.assigned_user_names.join(', ')
                        : 'Unassigned'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">
                    ID: {project.id.slice(0, 16)}
                  </span>
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-400 hover:text-sky-300"
                  >
                    View Project Detail <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredProjects.length === 0 && !isLoading && (
        <div className="text-center py-16 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 space-y-3">
          <Briefcase className="h-8 w-8 text-slate-500 mx-auto" />
          <h3 className="font-bold text-sm text-slate-300">No Projects Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No projects matched your active filters or search criteria.
          </p>
        </div>
      )}

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateProject}
      />
    </div>
  );
}
