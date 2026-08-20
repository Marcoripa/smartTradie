'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { TaxInvoice } from '../../../types/invoice';
import {
  FileText,
  Plus,
  Search,
  Printer,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Lock,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../components/ui/table';
import { formatCurrency, formatDate } from '../../../lib/utils';

export default function InvoicesListPage() {
  const { isAdmin } = useAuth();
  const [invoices, setInvoices] = useState<TaxInvoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    async function loadInvoices() {
      const data = await api.getInvoices();
      setInvoices(data);
    }
    loadInvoices();
  }, []);

  if (!isAdmin) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="h-12 w-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Admin Access Required</h2>
        <p className="text-xs text-slate-400">
          Invoicing, financial margins, and ATO tax calculations are restricted to Business Owners.
        </p>
      </div>
    );
  }

  const totalInvoiced = invoices.reduce((acc, inv) => acc + inv.total_inc_gst, 0);
  const totalGst = invoices.reduce((acc, inv) => acc + inv.total_gst, 0);
  const totalOutstanding = invoices.reduce((acc, inv) => acc + inv.balance_due, 0);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.buyer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.project_name && inv.project_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <FileText className="h-6 w-6 text-sky-400" />
            Invoices
          </h2>
          {/* <p className="text-xs sm:text-sm text-slate-400">
            Australian Taxation Office (ATO) compliant tax invoices with automatic 10% GST calculations.
          </p> */}
        </div>

        <Link href="/dashboard/projects">
          <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-xs font-semibold gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Generate from Project Hub
          </Button>
        </Link>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">
              Total Invoiced (Inc GST)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{formatCurrency(totalInvoiced)}</div>
            <p className="text-[11px] text-slate-400 mt-1">
              Includes {formatCurrency(totalGst)} in 10% ATO GST
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">
              GST Payable to ATO
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-400">{formatCurrency(totalGst)}</div>
            <p className="text-[11px] text-slate-400 mt-1">
              Based on standard 10% GST on taxable supplies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">
              Outstanding Balance
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{formatCurrency(totalOutstanding)}</div>
            <p className="text-[11px] text-amber-400/90 mt-1">
              {totalOutstanding === 0 ? 'All invoices paid in full' : 'Awaiting payment transfer'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search invoice #, client, or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-950 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {['ALL', 'DRAFT', 'SENT', 'PAID', 'OVERDUE'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === status
                  ? 'bg-sky-500 text-white font-semibold shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Invoice #</TableHead>
              <TableHead>Client / Buyer</TableHead>
              <TableHead>Project Reference</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total (inc GST)</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-xs font-bold text-sky-400">
                  {inv.invoice_number}
                </TableCell>

                <TableCell>
                  <p className="font-semibold text-xs text-slate-100">{inv.buyer.name}</p>
                  {inv.buyer.abn && (
                    <span className="text-[10px] text-slate-400">ABN: {inv.buyer.abn}</span>
                  )}
                </TableCell>

                <TableCell className="text-xs text-slate-300">
                  {inv.project_name || 'General Contracting'}
                </TableCell>

                <TableCell className="text-xs text-slate-400">
                  {formatDate(inv.issue_date)}
                </TableCell>

                <TableCell className="text-xs text-slate-400">
                  {formatDate(inv.due_date)}
                </TableCell>

                <TableCell className="text-right font-mono text-xs font-bold text-slate-100">
                  {formatCurrency(inv.total_inc_gst)}
                </TableCell>

                <TableCell className="text-center">
                  <Badge
                    variant={
                      inv.status === 'PAID'
                        ? 'success'
                        : inv.status === 'SENT'
                        ? 'default'
                        : 'secondary'
                    }
                    className="text-[10px]"
                  >
                    {inv.status}
                  </Badge>
                </TableCell>

                <TableCell className="text-right">
                  <Link href={`/dashboard/invoices/${inv.id}`}>
                    <Button size="sm" variant="outline" className="h-7 text-xs font-semibold gap-1">
                      <Printer className="h-3 w-3" /> View / Print
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
