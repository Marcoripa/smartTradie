'use client';

import React from 'react';
import { TaxInvoice } from '../../types/invoice';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Button } from '../ui/button';
import { Printer, Download, Building2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Badge } from '../ui/badge';

interface ATOTaxInvoiceDocumentProps {
  invoice: TaxInvoice;
  onPrint?: () => void;
}

export const ATOTaxInvoiceDocument: React.FC<ATOTaxInvoiceDocumentProps> = ({
  invoice,
  onPrint,
}) => {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar (hidden during browser print) */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <Badge
            variant={
              invoice.status === 'PAID'
                ? 'success'
                : invoice.status === 'SENT'
                ? 'default'
                : 'secondary'
            }
          >
            {invoice.status}
          </Badge>
          <span className="text-xs text-slate-400">
            ATO Compliant Australian Tax Invoice
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5 text-xs">
            <Printer className="h-3.5 w-3.5" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* The Printable Tax Invoice Paper Canvas */}
      <div className="bg-white text-slate-900 rounded-xl p-8 sm:p-12 shadow-2xl border border-slate-200 max-w-4xl mx-auto font-sans print:shadow-none print:border-none print:p-0 print:m-0">
        {/* ATO Mandatory Prominent Title & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start pb-8 border-b-2 border-slate-900 gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                ST
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                {invoice.seller.business_name}
              </h2>
            </div>
            {invoice.seller.trading_name && (
              <p className="text-xs text-slate-600 font-medium">
                Trading as: {invoice.seller.trading_name}
              </p>
            )}
            <p className="text-sm font-bold text-slate-800 tracking-wide">
              ABN: {invoice.seller.abn}
            </p>
            <p className="text-xs text-slate-600 leading-tight">
              {invoice.seller.address}, {invoice.seller.city} {invoice.seller.state} {invoice.seller.postcode}
            </p>
            <p className="text-xs text-slate-600">
              Phone: {invoice.seller.phone} • Email: {invoice.seller.email}
            </p>
          </div>

          <div className="text-right space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">
              TAX INVOICE
            </h1>
            <p className="text-sm font-bold text-slate-800 font-mono">
              Invoice #{invoice.invoice_number}
            </p>
            <p className="text-xs text-slate-600">
              <strong>Issue Date:</strong> {formatDate(invoice.issue_date)}
            </p>
            <p className="text-xs text-slate-600">
              <strong>Due Date:</strong> {formatDate(invoice.due_date)}
            </p>
            <p className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded inline-block mt-1">
              Terms: {invoice.payment_terms}
            </p>
          </div>
        </div>

        {/* Buyer / Client Section (ATO Required) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6 border-b border-slate-200 text-xs">
          <div>
            <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
              INVOICE TO (BUYER):
            </p>
            <p className="font-bold text-sm text-slate-950">{invoice.buyer.name}</p>
            {invoice.buyer.company_name && (
              <p className="font-medium text-slate-800">{invoice.buyer.company_name}</p>
            )}
            {invoice.buyer.abn && (
              <p className="font-bold text-slate-800 text-xs mt-0.5">
                Client ABN: {invoice.buyer.abn}
              </p>
            )}
            <p className="text-slate-600 mt-1">{invoice.buyer.address}</p>
            {invoice.buyer.email && <p className="text-slate-600">Email: {invoice.buyer.email}</p>}
            {invoice.buyer.phone && <p className="text-slate-600">Phone: {invoice.buyer.phone}</p>}
          </div>

          <div>
            <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
              PROJECT / SITE REFERENCE:
            </p>
            <p className="font-bold text-slate-900">{invoice.project_name || 'General Contracting'}</p>
            {invoice.project_id && (
              <p className="font-mono text-slate-500 text-[11px]">ID: {invoice.project_id}</p>
            )}
            <div className="mt-3 p-2.5 bg-emerald-50 rounded border border-emerald-200 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-[11px] text-emerald-800 font-semibold leading-tight">
                Verified with On-Site Digital Time Logs & AI Voice Verifications
              </span>
            </div>
          </div>
        </div>

        {/* Line Items Table (ATO Format) */}
        <div className="py-6 border-b border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 text-slate-950 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 pr-3">Item / Description</th>
                <th className="py-2.5 px-2 text-center">Type</th>
                <th className="py-2.5 px-2 text-right">Qty</th>
                <th className="py-2.5 px-2 text-right">Unit Price (ex GST)</th>
                <th className="py-2.5 px-2 text-center">GST</th>
                <th className="py-2.5 pl-3 text-right">Total (AUD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.line_items.map((item, idx) => (
                <tr key={item.id || idx} className="text-slate-800">
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-slate-950">{item.description}</p>
                    {item.inventory_sku && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        SKU: {item.inventory_sku}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-medium">
                      {item.item_type}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right font-medium">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-3 px-2 text-right font-mono font-medium">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="text-[10px] font-semibold text-emerald-700">
                      {item.is_gst_taxable ? '10%' : 'FREE'}
                    </span>
                  </td>
                  <td className="py-3 pl-3 text-right font-mono font-bold text-slate-950">
                    {formatCurrency(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ATO Tax Calculation Summary Block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6 border-b border-slate-200">
          {/* Payment Details Box (Direct Deposit & PayID) */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-2">
            <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
              HOW TO PAY (DIRECT DEPOSIT EFT):
            </p>
            <div className="space-y-1 font-mono text-slate-800">
              <p>
                <span className="text-slate-500 font-sans">Account Name:</span>{' '}
                <strong>{invoice.seller.bank_account_name}</strong>
              </p>
              <p>
                <span className="text-slate-500 font-sans">BSB:</span>{' '}
                <strong className="tracking-widest">{invoice.seller.bank_bsb}</strong>
              </p>
              <p>
                <span className="text-slate-500 font-sans">Account No:</span>{' '}
                <strong className="tracking-widest">{invoice.seller.bank_account_number}</strong>
              </p>
              {invoice.seller.payid && (
                <p>
                  <span className="text-slate-500 font-sans">PayID:</span>{' '}
                  <strong>{invoice.seller.payid}</strong>
                </p>
              )}
              <p>
                <span className="text-slate-500 font-sans">Reference:</span>{' '}
                <strong className="text-sky-700">{invoice.invoice_number}</strong>
              </p>
            </div>
          </div>

          {/* Totals Calculation */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 text-slate-600">
              <span>Subtotal (excluding GST):</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCurrency(invoice.subtotal_ex_gst)}
              </span>
            </div>

            <div className="flex justify-between py-1 text-slate-600 border-b border-slate-200">
              <span>Goods & Services Tax (GST 10%):</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCurrency(invoice.total_gst)}
              </span>
            </div>

            <div className="flex justify-between py-2 text-base font-black text-slate-950">
              <span>Total Amount Payable:</span>
              <span className="font-mono text-lg text-slate-950">
                {formatCurrency(invoice.total_inc_gst)}
              </span>
            </div>

            {/* ATO Mandated Label */}
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-700 italic bg-slate-100 px-2 py-0.5 rounded">
                * Total price includes GST
              </span>
            </div>

            {invoice.amount_paid > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Amount Paid:</span>
                  <span className="font-mono text-emerald-700 font-bold">
                    {formatCurrency(invoice.amount_paid)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Balance Due:</span>
                  <span className="font-mono text-slate-950">
                    {formatCurrency(invoice.balance_due)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Notes */}
        <div className="pt-6 text-center text-[11px] text-slate-500 space-y-1">
          <p>{invoice.notes || 'Thank you for your business.'}</p>
          <p className="text-[10px] text-slate-400">
            Generated via SmartTradie ERP System • Compliant with Australian Taxation Office (ATO) GST Rulings
          </p>
        </div>
      </div>
    </div>
  );
};
