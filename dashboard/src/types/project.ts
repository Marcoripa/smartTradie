export type ProjectStatus = 'in progress' | 'IN_PROGRESS' | 'PENDING' | 'COMPLETED' | 'INVOICED' | string;

export interface ExtractedMaterial {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  cost_price?: number;
  sell_price: number;
  approved: boolean;
  added_to_invoice: boolean;
  inventory_deducted: boolean;
  matched_inventory_sku?: string;
}

export interface VoiceLog {
  id: string;
  project_id: string;
  project_name: string;
  user_id: string;
  user_name: string;
  workflow_id: string;
  workflow_title: string;
  timestamp: string;
  raw_transcript: string;
  summary: string;
  audio_url: string;
  latitude?: number;
  longitude?: number;
  location_address?: string;
  action_items: string[];
  extracted_materials: ExtractedMaterial[];
  sync_status: 'PENDING_SYNC' | 'SYNCED';
  firestore_id?: string;
}

export interface Project {
  id: string;
  business_id: string;
  name: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  client_abn?: string;
  site_address: string;
  latitude?: number;
  longitude?: number;
  status: ProjectStatus;
  assigned_user_ids: string[];
  assigned_user_names?: string[];
  estimated_hours?: number;
  logged_hours?: number;
  created_at: string;
  updated_at: string;
  voice_logs?: VoiceLog[];
}
