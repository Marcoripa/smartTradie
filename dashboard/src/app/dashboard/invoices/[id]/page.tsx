'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../../context/AuthContext';
import { api } from '../../../../lib/api';
import { TaxInvoice } from '../../../../types/invoice';
import {
  FileText,
  ArrowLeft,
  Lock,
  Printer,
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { ATOTaxInvoiceDocument } from '../../../../components/invoices/ATOTaxInvoiceDocument';

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { isAdmin } = useAuth();
  const [invoice, setInvoice] = useState<TaxInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadInvoice() {
      try {
        const data = await api.getInvoiceById(resolvedParams.id);
        setInvoice(data);
      } finally {
        setIsLoading(false);
      }
    }
    loadInvoice();
  }, [resolvedParams.id]);

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

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <p className="animate-pulse text-sm">Loading ATO Tax Invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-base text-slate-300 font-semibold">Tax Invoice not found</p>
        <Link href="/dashboard/invoices">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/dashboard/invoices"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </Link>
      </div>

      {/* ATO Tax Invoice Component */}
      <ATOTaxInvoiceDocument invoice={invoice} />
    </div>
  );
}
