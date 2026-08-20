'use client';

import React, { useState } from 'react';
import { ExtractedMaterial } from '../../types/project';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  Package,
  FilePlus2,
  Boxes,
  AlertTriangle,
  Layers,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { formatCurrency } from '../../lib/utils';

interface AIMaterialApprovalWidgetProps {
  materials: ExtractedMaterial[];
  voiceLogId: string;
  projectId: string;
  onApprove: (materialId: string, deductInventory: boolean) => Promise<void>;
}

export const AIMaterialApprovalWidget: React.FC<AIMaterialApprovalWidgetProps> = ({
  materials,
  voiceLogId,
  projectId,
  onApprove,
}) => {
  const { isAdmin } = useAuth();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  if (!materials || materials.length === 0) {
    return null;
  }

  const handleApprove = async (materialId: string, deductInventory: boolean) => {
    setApprovingId(materialId);
    try {
      await onApprove(materialId, deductInventory);
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-4 space-y-3">
      {/* Widget Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100">
              AI-Extracted Job Materials ({materials.length})
            </h4>
            <p className="text-[11px] text-slate-400">
              Spoken field items ready for inventory deduction and client invoicing.
            </p>
          </div>
        </div>
        <Badge variant="default" className="text-[10px]">
          Whisper & Llama Verified
        </Badge>
      </div>

      {/* Materials List */}
      <div className="space-y-2.5">
        {materials.map((mat) => {
          const isPending = !mat.approved;

          return (
            <div
              key={mat.id}
              className={`rounded-lg border p-3 transition-all ${
                mat.approved
                  ? 'bg-slate-950/70 border-emerald-500/30'
                  : 'bg-slate-900 border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Item Details */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-100">
                      {mat.quantity} {mat.unit} × {mat.item_name}
                    </span>
                    {mat.matched_inventory_sku && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                        {mat.matched_inventory_sku}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span>
                      Billable Unit: <strong className="text-slate-200">{formatCurrency(mat.sell_price)}</strong>
                    </span>
                    <span>
                      Line Total: <strong className="text-sky-400">{formatCurrency(mat.quantity * mat.sell_price)}</strong>
                    </span>
                    {isAdmin && mat.cost_price && (
                      <span className="text-slate-500">
                        (Cost: {formatCurrency(mat.cost_price)})
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Badges & Action Buttons */}
                <div className="flex items-center gap-2">
                  {mat.approved ? (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="success" className="text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Approved
                      </Badge>
                      {mat.inventory_deducted && (
                        <Badge variant="secondary" className="text-[10px] text-slate-300">
                          <Boxes className="h-3 w-3 mr-1 text-sky-400" />
                          Warehouse Deducted
                        </Badge>
                      )}
                    </div>
                  ) : (
                    isAdmin && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="success"
                          className="h-7 text-xs px-2.5"
                          disabled={approvingId === mat.id}
                          onClick={() => handleApprove(mat.id, true)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          {approvingId === mat.id ? 'Processing...' : 'Approve & Deduct Stock'}
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
