export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number; // ex-GST
  is_gst_taxable: boolean; // true = 10% GST applies; false = GST-free
  line_subtotal: number;
  line_gst: number;
  line_total: number;
  item_type: 'LABOR' | 'MATERIAL' | 'EQUIPMENT' | 'CALL_OUT_FEE' | 'OTHER';
  inventory_sku?: string;
}

export interface BusinessSellerProfile {
  business_name: string;
  trading_name?: string;
  abn: string; // 11-digit Australian Business Number e.g. "51 824 753 556"
  address: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
  email: string;
  bank_bsb: string;
  bank_account_number: string;
  bank_account_name: string;
  payid?: string;
}

export interface ClientBuyerProfile {
  name: string;
  company_name?: string;
  abn?: string; // Required by ATO for invoices over $1,000
  address: string;
  city?: string;
  state?: string;
  postcode?: string;
  email?: string;
  phone?: string;
}

export interface TaxInvoice {
  id: string;
  invoice_number: string; // e.g. "INV-2026-0042"
  business_id: string;
  project_id?: string;
  project_name?: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  payment_terms: string; // e.g. "14 Days from date of invoice"
  seller: BusinessSellerProfile;
  buyer: ClientBuyerProfile;
  line_items: InvoiceLineItem[];
  subtotal_ex_gst: number;
  total_gst: number;
  total_inc_gst: number;
  amount_paid: number;
  balance_due: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}
