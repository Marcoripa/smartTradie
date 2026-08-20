'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Project, VoiceLog } from '../../types/project';
import { InventoryItem } from '../../types/inventory';
import { TaxInvoice } from '../../types/invoice';
import {
  Briefcase,
  Package,
  FileText,
  Clock,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Radio,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { formatCurrency, formatDateTime } from '../../lib/utils';

export default function DashboardOverviewPage() {
  const { user, role, isAdmin } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invoices, setInvoices] = useState<TaxInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [projData, invData, invcData] = await Promise.all([
          api.getProjects(),
          api.getInventory(),
          api.getInvoices(),
        ]);
        setProjects(projData);
        setInventory(invData);
        setInvoices(invcData);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const activeProjects = projects.filter((p) => {
    const s = (p.status || 'in progress').toLowerCase();
    return s === 'in progress' || s === 'in_progress' || s === 'pending';
  });

  const lowStockItems = inventory.filter(
    (i) => i.stock_quantity <= i.low_stock_threshold
  );

  // Collect all voice notes across projects
  const allVoiceLogs: VoiceLog[] = projects
    .flatMap((p) => p.voice_logs || [])
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Count unapproved materials
  const unapprovedMaterialsCount = allVoiceLogs.reduce((acc, log) => {
    return acc + (log.extracted_materials?.filter((m) => !m.approved).length || 0);
  }, 0);

  const totalInvoiced = invoices.reduce((acc, inv) => acc + inv.total_inc_gst, 0);
  const totalLoggedHours = projects.reduce((acc, p) => acc + (p.logged_hours || 0), 0);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950 p-6 rounded-2xl border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
              {isAdmin ? 'Office Executive Portal' : 'Tradie Portal'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
            G'day, {user?.name || 'there'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            {isAdmin
              ? `You have ${activeProjects.length} active jobs on-site and ${unapprovedMaterialsCount} voice materials awaiting office sign-off.`
              : `You are assigned to ${activeProjects.length} active jobs across the region.`}
          </p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">
              Active Projects
            </CardTitle>
            <Briefcase className="h-4 w-4 text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{activeProjects.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">
              {totalLoggedHours} billable hours logged in field
            </p>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className={lowStockItems.length > 0 ? 'border-amber-500/30 bg-amber-950/10' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">
              Low Stock Warnings
            </CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${
                lowStockItems.length > 0 ? 'text-amber-400' : 'text-slate-400'
              }`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{lowStockItems.length}</div>
            <p className="text-[11px] text-amber-400/90 mt-1">
              {lowStockItems.length > 0
                ? `${lowStockItems[0].name.slice(0, 24)}... needs reorder`
                : 'All warehouse stock healthy'}
            </p>
          </CardContent>
        </Card>

        {/* AI Extracted Materials */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">
              Voice Note Materials
            </CardTitle>
            <Sparkles className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              {unapprovedMaterialsCount} Pending
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Parsed from on-device Llama 3.2
            </p>
          </CardContent>
        </Card>

        {/* Total Invoiced (Admin Only) */}
        {isAdmin ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">
                Invoiced Total (YTD)
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-100">
                {formatCurrency(totalInvoiced)}
              </div>
              <p className="text-[11px] text-emerald-400 mt-1">
                Inc 10% ATO GST ({formatCurrency(totalInvoiced * 0.10 / 1.10)})
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">
                Warehouse Catalog
              </CardTitle>
              <Package className="h-4 w-4 text-sky-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-100">{inventory.length} SKUs</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Available for mobile check-out
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Grid: Recent Voice Field Notes & Active Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Field Voice Notes Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-sky-400 animate-pulse" />
              <h3 className="font-bold text-sm text-slate-100">
                Recent Voice Logs from Mobile App
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {allVoiceLogs.slice(0, 3).map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 hover:border-slate-700 transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="purple" className="text-[10px]">
                      {log.workflow_title || 'Voice Log'}
                    </Badge>
                    <span className="font-semibold text-xs text-slate-200">
                      {log.project_name || 'Field Project'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {formatDateTime(log.timestamp)}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
                  {log.summary || log.raw_transcript}
                </p>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400">Recorded by 👤 {log.user_name || 'Tradie'}</span>
                  {log.project_id && (
                    <Link
                      href={`/dashboard/projects/${log.project_id}`}
                      className="text-sky-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      Open Project Detail <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Quick Project Access & Low Stock List */}
        <div className="space-y-6">
          {/* Active Projects List */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-sky-400" />
              On-Site Active Jobs
            </h3>
            <div className="space-y-2">
              {projects.slice(0, 3).map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}`}
                  className="block p-3 rounded-lg border border-slate-800 bg-slate-900 hover:border-sky-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-100 truncate">{p.name || 'Untitled Project'}</span>
                    <Badge
                      variant={(p.status || 'in progress').toLowerCase().includes('progress') ? 'default' : 'secondary'}
                      className="text-[9px] capitalize"
                    >
                      {(p.status || 'in progress').replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">{p.client_name || 'Trade Client'}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                    <span>{p.logged_hours || 0} hrs logged</span>
                    <span className="text-sky-400 font-medium">Details →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Low Stock Quick Warning */}
          {lowStockItems.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <AlertTriangle className="h-4 w-4" />
                Warehouse Low Stock
              </div>
              <p className="text-[11px] text-slate-300">
                {lowStockItems.length} items below minimum threshold.
              </p>
              <div className="space-y-1.5 pt-1">
                {lowStockItems.slice(0, 2).map((item) => (
                  <div key={item.id} className="flex justify-between text-xs text-slate-200">
                    <span className="truncate max-w-[160px]">{item.name}</span>
                    <span className="font-bold text-amber-400">
                      {item.stock_quantity} {item.unit} left
                    </span>
                  </div>
                ))}
              </div>
              <Link
                href="/dashboard/inventory"
                className="block text-center text-xs text-amber-400 font-semibold pt-2 hover:underline"
              >
                Manage Inventory & Reorder →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
