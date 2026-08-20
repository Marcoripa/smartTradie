export interface InventoryItem {
  id: string;
  business_id: string;
  sku: string;
  name: string;
  category: string;
  stock_quantity: number;
  low_stock_threshold: number;
  unit: string; // e.g. 'pcs', 'meters', 'bags', 'kg', 'boxes'
  cost_price: number; // Cost to business (Admin visible only)
  sell_price: number; // Billable price to client
  markup_percent: number; // calculated e.g. 35%
  location_bin?: string;
  updated_at: string;
}

export interface StockAuditLog {
  id: string;
  inventory_item_id: string;
  item_name: string;
  sku: string;
  quantity_changed: number; // negative for deduction, positive for restock
  previous_stock: number;
  new_stock: number;
  reason: 'PROJECT_VOICE_DEDUCTION' | 'MANUAL_ADJUSTMENT' | 'RESTOCK_PO' | 'DAMAGE_WRITE_OFF';
  project_id?: string;
  project_name?: string;
  voice_log_id?: string;
  user_name: string;
  timestamp: string;
}
