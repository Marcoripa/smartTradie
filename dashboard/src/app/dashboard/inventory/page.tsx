'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { InventoryItem, StockAuditLog } from '../../../types/inventory';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Boxes,
  History,
  TrendingUp,
  Tag,
  DollarSign,
  Edit2,
  CheckCircle2,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { formatCurrency, formatDateTime } from '../../../lib/utils';

export default function InventoryPage() {
  const { isAdmin } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [audits, setAudits] = useState<StockAuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Form states for creating/editing item
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Cabling & Wiring');
  const [stockQuantity, setStockQuantity] = useState('100');
  const [lowStockThreshold, setLowStockThreshold] = useState('20');
  const [unit, setUnit] = useState('pcs');
  const [costPrice, setCostPrice] = useState('10.0');
  const [sellPrice, setSellPrice] = useState('20.0');

  useEffect(() => {
    async function loadInventoryData() {
      const [invData, auditData] = await Promise.all([
        api.getInventory(),
        api.getStockAudits(),
      ]);
      setInventory(invData);
      setAudits(auditData);
    }
    loadInventoryData();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setSku('');
    setName('');
    setCategory('Cabling & Wiring');
    setStockQuantity('100');
    setLowStockThreshold('20');
    setUnit('pcs');
    setCostPrice('10.0');
    setSellPrice('20.0');
    setIsItemModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setSku(item.sku);
    setName(item.name);
    setCategory(item.category);
    setStockQuantity(String(item.stock_quantity));
    setLowStockThreshold(String(item.low_stock_threshold));
    setUnit(item.unit);
    setCostPrice(String(item.cost_price));
    setSellPrice(String(item.sell_price));
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) return;

    if (editingItem) {
      const updated = await api.updateInventoryItem(editingItem.id, {
        sku: sku.trim(),
        name: name.trim(),
        category,
        stock_quantity: Number(stockQuantity) || 0,
        low_stock_threshold: Number(lowStockThreshold) || 5,
        unit: unit.trim(),
        costPrice: Number(costPrice) || 0,
        sellPrice: Number(sellPrice) || 0,
      } as any);
      if (updated) {
        setInventory((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      }
    } else {
      const created = await api.createInventoryItem({
        business_id: '',
        sku: sku.trim(),
        name: name.trim(),
        category,
        stock_quantity: Number(stockQuantity) || 0,
        low_stock_threshold: Number(lowStockThreshold) || 5,
        unit: unit.trim(),
        cost_price: Number(costPrice) || 0,
        sell_price: Number(sellPrice) || 0,
      });
      setInventory((prev) => [created, ...prev]);
    }
    setIsItemModalOpen(false);
  };

  const categories = ['ALL', ...Array.from(new Set(inventory.map((i) => i.category)))];

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const lowStockCount = inventory.filter((i) => i.stock_quantity <= i.low_stock_threshold).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Package className="h-6 w-6 text-sky-400" />
            Materials
          </h2>
          {/* <p className="text-xs sm:text-sm text-slate-400">
            Real-time warehouse stock tracking with automated field voice deductions.
          </p> */}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAuditModalOpen(true)}
            className="text-xs gap-1.5"
          >
            <History className="h-4 w-4 text-sky-400" />
            Stock Deduction Audit Log ({audits.length})
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              onClick={openCreateModal}
              className="bg-sky-500 hover:bg-sky-600 text-xs font-semibold gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search SKU or item name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-950 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-sky-500 text-white font-semibold shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* TanStack-style Shadcn Inventory Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">SKU / Code</TableHead>
              <TableHead>Item Name & Category</TableHead>
              <TableHead className="text-center">Stock Level</TableHead>
              <TableHead className="text-center">Low Threshold</TableHead>
              {isAdmin && <TableHead className="text-right">Cost Price</TableHead>}
              <TableHead className="text-right">Billable Sell Price</TableHead>
              {isAdmin && <TableHead className="text-right">Markup %</TableHead>}
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInventory.map((item) => {
              const isLowStock = item.stock_quantity <= item.low_stock_threshold;

              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs font-bold text-sky-400">
                    {item.sku}
                  </TableCell>

                  <TableCell>
                    <p className="font-semibold text-xs text-slate-100">{item.name}</p>
                    <span className="text-[10px] text-slate-400">{item.category}</span>
                  </TableCell>

                  <TableCell className="text-center">
                    {isLowStock ? (
                      <Badge variant="destructive" className="text-[10px] font-bold">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {item.stock_quantity} {item.unit} (LOW)
                      </Badge>
                    ) : (
                      <Badge variant="success" className="text-[10px]">
                        {item.stock_quantity} {item.unit}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-center text-xs text-slate-400">
                    {item.low_stock_threshold} {item.unit}
                  </TableCell>

                  {isAdmin && (
                    <TableCell className="text-right font-mono text-xs text-slate-400">
                      {formatCurrency(item.cost_price)}
                    </TableCell>
                  )}

                  <TableCell className="text-right font-mono text-xs font-bold text-slate-100">
                    {formatCurrency(item.sell_price)}
                  </TableCell>

                  {isAdmin && (
                    <TableCell className="text-right font-mono text-xs text-emerald-400 font-semibold">
                      +{item.markup_percent}%
                    </TableCell>
                  )}

                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(item)}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-slate-100"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Item Create / Edit Modal */}
      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Warehouse Item' : 'Add New Inventory Item'}
            </DialogTitle>
            <DialogDescription>
              Set pricing, minimum reorder thresholds, and warehouse location bin.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveItem} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU / Item Code *</Label>
                <Input
                  id="sku"
                  placeholder="e.g. EL-CBL-16MM"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g. Cabling & Wiring"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-name">Item Description *</Label>
              <Input
                id="item-name"
                placeholder="e.g. 16mm² 4-Core XLPE Heavy Duty Armoured Cable"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qty">Stock Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="thresh">Low Alert Threshold</Label>
                <Input
                  id="thresh"
                  type="number"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit">Unit (pcs, m, bags)</Label>
                <Input
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
            </div>

            {isAdmin && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="space-y-1.5">
                  <Label htmlFor="cost">Cost Price ($ AUD)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.1"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sell">Client Billable Price ($ AUD)</Label>
                  <Input
                    id="sell"
                    type="number"
                    step="0.1"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingItem ? 'Save Changes' : 'Create Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Deduction Audit Log Modal */}
      <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-sky-400" />
              Stock Deduction Audit Log
            </DialogTitle>
            <DialogDescription>
              Automatic audit trail of materials logged via mobile voice sessions and project approvals.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto space-y-2 py-2">
            {audits.map((aud) => (
              <div
                key={aud.id}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100">{aud.item_name}</span>
                  <span className="font-mono font-bold text-red-400">
                    {aud.quantity_changed} units
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Project: <strong>{aud.project_name}</strong></span>
                  <span>👤 Logged by {aud.user_name}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[10px] pt-1">
                  <span>Stock: {aud.previous_stock} → {aud.new_stock}</span>
                  <span>{formatDateTime(aud.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAuditModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
