import { User } from '../types/auth';
import { Project, VoiceLog, ExtractedMaterial } from '../types/project';
import { InventoryItem, StockAuditLog } from '../types/inventory';
import { TaxInvoice, BusinessSellerProfile } from '../types/invoice';
import { hashPassword } from './cryptoUtils';

export interface FirestoreConfig {
  projectId: string;
  databaseId: string;
}

export const defaultDashboardFirestoreConfig: FirestoreConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'smarttradie-505506',
  databaseId: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || 'smart-tradie',
};

// Helper: Convert clean JS object to Firestore Document Fields
function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: value.toString() };
      } else {
        fields[key] = { doubleValue: value };
      }
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map((item) => {
            if (typeof item === 'string') return { stringValue: item };
            if (typeof item === 'number') return { doubleValue: item };
            if (typeof item === 'boolean') return { booleanValue: item };
            if (typeof item === 'object') return { mapValue: { fields: toFirestoreFields(item) } };
            return { stringValue: String(item) };
          }),
        },
      };
    } else if (typeof value === 'object') {
      fields[key] = { mapValue: { fields: toFirestoreFields(value) } };
    }
  }

  return fields;
}

// Helper: Convert Firestore Document Fields to clean JS object
function fromFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const obj: Record<string, any> = {};
  if (!fields) return obj;

  for (const [key, val] of Object.entries(fields)) {
    if ('stringValue' in val) {
      obj[key] = val.stringValue;
    } else if ('integerValue' in val) {
      obj[key] = parseInt(val.integerValue, 10);
    } else if ('doubleValue' in val) {
      obj[key] = parseFloat(val.doubleValue);
    } else if ('booleanValue' in val) {
      obj[key] = val.booleanValue;
    } else if ('nullValue' in val) {
      obj[key] = null;
    } else if ('timestampValue' in val) {
      obj[key] = val.timestampValue;
    } else if ('arrayValue' in val) {
      obj[key] = (val.arrayValue.values || []).map((itemVal: any) => {
        if ('stringValue' in itemVal) return itemVal.stringValue;
        if ('integerValue' in itemVal) return parseInt(itemVal.integerValue, 10);
        if ('doubleValue' in itemVal) return parseFloat(itemVal.doubleValue);
        if ('booleanValue' in itemVal) return itemVal.booleanValue;
        if ('mapValue' in itemVal) return fromFirestoreFields(itemVal.mapValue.fields || {});
        return null;
      });
    } else if ('mapValue' in val) {
      obj[key] = fromFirestoreFields(val.mapValue.fields || {});
    }
  }

  return obj;
}

export class FirestoreDashboardService {
  private static instance: FirestoreDashboardService;
  private config: FirestoreConfig = defaultDashboardFirestoreConfig;
  private currentBusinessId: string | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.currentBusinessId = localStorage.getItem('smart_tradie_business_id') || null;
    }
  }

  public static getInstance(): FirestoreDashboardService {
    if (!FirestoreDashboardService.instance) {
      FirestoreDashboardService.instance = new FirestoreDashboardService();
    }
    return FirestoreDashboardService.instance;
  }

  public setConfig(cfg: Partial<FirestoreConfig>): void {
    this.config = { ...this.config, ...cfg };
  }

  public setBusinessId(businessId: string): void {
    const cleanId = businessId.replace(/^\/?businesses\//, '').trim();
    this.currentBusinessId = cleanId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('smart_tradie_business_id', cleanId);
    }
    console.log(`[Firestore] Active Business ID set to: ${cleanId}`);
  }

  public getBusinessId(): string {
    if (!this.currentBusinessId && typeof window !== 'undefined') {
      this.currentBusinessId = localStorage.getItem('smart_tradie_business_id') || '';
    }
    return this.currentBusinessId || '';
  }

  private getBaseUrl(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/${this.config.databaseId}/documents`;
  }

  /**
   * Universal User Lookup by Email (Across any Business in Firestore)
   */
  public async findUserByEmail(email: string): Promise<User | null> {
    const cleanEmail = email.toLowerCase().trim();

    // 1. Try Collection Group structuredQuery across all `users` subcollections
    try {
      const queryEndpoint = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/${this.config.databaseId}/documents:runQuery`;
      const queryPayload = {
        structuredQuery: {
          from: [{ collectionId: 'users', allDescendants: true }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'email' },
              op: 'EQUAL',
              value: { stringValue: cleanEmail },
            },
          },
          limit: 1,
        },
      };

      const res = await fetch(queryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryPayload),
      });

      if (res.ok) {
        const results = await res.json();
        for (const item of results) {
          if (item.document) {
            const doc = item.document;
            const raw = fromFirestoreFields(doc.fields || {});
            
            // Extract businessId from document path: projects/.../documents/businesses/{bizId}/users/{userId}
            const pathParts = doc.name.split('/');
            const bizIndex = pathParts.indexOf('businesses');
            const extractedBizId = (bizIndex !== -1 && pathParts[bizIndex + 1]) ? pathParts[bizIndex + 1] : (raw.business_id || '');
            const docId = pathParts[pathParts.length - 1];

            return {
              id: raw.id || docId,
              name: raw.name || cleanEmail.split('@')[0],
              email: raw.email || cleanEmail,
              password: raw.password || raw.password_hash,
              phone: raw.phone || '',
              role: (raw.role as any) || 'USER',
              business_id: extractedBizId,
              business_name: raw.business_name || '',
              hourly_wage: raw.hourly_wage !== undefined ? Number(raw.hourly_wage) : 52,
              charge_out_rate: raw.charge_out_rate !== undefined ? Number(raw.charge_out_rate) : 125,
              active: raw.active !== undefined ? Boolean(raw.active) : true,
              created_at: raw.created_at || doc.createTime || new Date().toISOString(),
            };
          }
        }
      }
    } catch (e) {
      console.warn('[Firestore] collectionGroup user search notice:', e);
    }

    // 2. Direct lookup under known business IDs (including active and created businesses)
    const bizCandidates = [this.getBusinessId(), '4hYresNm9x4jeTkMWtYy'].filter(Boolean);
    for (const bId of Array.from(new Set(bizCandidates))) {
      try {
        const usersEndpoint = `${this.getBaseUrl()}/businesses/${bId}/users`;
        const res = await fetch(usersEndpoint);
        if (res.ok) {
          const data = await res.json();
          const docs = data.documents || [];
          for (const doc of docs) {
            const raw = fromFirestoreFields(doc.fields || {});
            if (raw.email && raw.email.toLowerCase().trim() === cleanEmail) {
              const docId = doc.name.split('/').pop();
              return {
                id: raw.id || docId,
                name: raw.name || cleanEmail.split('@')[0],
                email: raw.email,
                password: raw.password || raw.password_hash,
                phone: raw.phone || '',
                role: (raw.role as any) || 'USER',
                business_id: bId,
                business_name: raw.business_name || '',
                hourly_wage: raw.hourly_wage !== undefined ? Number(raw.hourly_wage) : 52,
                charge_out_rate: raw.charge_out_rate !== undefined ? Number(raw.charge_out_rate) : 125,
                active: raw.active !== undefined ? Boolean(raw.active) : true,
                created_at: raw.created_at || doc.createTime || new Date().toISOString(),
              };
            }
          }
        }
      } catch {}
    }

    // 3. Top-level /users check
    try {
      const topUsersEndpoint = `${this.getBaseUrl()}/users`;
      const res = await fetch(topUsersEndpoint);
      if (res.ok) {
        const data = await res.json();
        const docs = data.documents || [];
        for (const doc of docs) {
          const raw = fromFirestoreFields(doc.fields || {});
          if (raw.email && raw.email.toLowerCase().trim() === cleanEmail) {
            const docId = doc.name.split('/').pop();
            return {
              id: raw.id || docId,
              name: raw.name || cleanEmail.split('@')[0],
              email: raw.email,
              password: raw.password || raw.password_hash,
              phone: raw.phone || '',
              role: (raw.role as any) || 'USER',
              business_id: raw.business_id || '4hYresNm9x4jeTkMWtYy',
              business_name: raw.business_name || '',
              hourly_wage: raw.hourly_wage !== undefined ? Number(raw.hourly_wage) : 52,
              charge_out_rate: raw.charge_out_rate !== undefined ? Number(raw.charge_out_rate) : 125,
              active: raw.active !== undefined ? Boolean(raw.active) : true,
              created_at: raw.created_at || doc.createTime || new Date().toISOString(),
            };
          }
        }
      }
    } catch {}

    return null;
  }

  // --- 1. BUSINESS PROFILE ---
  public async getBusinessProfile(): Promise<BusinessSellerProfile | null> {
    const bizId = this.getBusinessId();
    if (!bizId) return null;

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}`;
    try {
      const res = await fetch(endpoint);
      if (!res.ok) return null;
      const data = await res.json();
      const raw = fromFirestoreFields(data.fields || {});
      return {
        business_name: raw.business_name || raw.name || '',
        trading_name: raw.trading_name || raw.business_name || raw.name || '',
        abn: raw.abn || '',
        address: raw.address || '',
        city: raw.city || '',
        state: raw.state || '',
        postcode: raw.postcode || '',
        phone: raw.phone || '',
        email: raw.email || '',
        bank_bsb: raw.bank_bsb || '',
        bank_account_number: raw.bank_account_number || '',
        bank_account_name: raw.bank_account_name || raw.business_name || '',
        payid: raw.payid || raw.email || '',
      };
    } catch (e) {
      console.warn(`[Firestore] Failed to fetch business profile for ${bizId}:`, e);
      return null;
    }
  }

  public async saveBusinessProfile(profile: BusinessSellerProfile): Promise<boolean> {
    const bizId = this.getBusinessId();
    if (!bizId) return false;

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}`;
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFirestoreFields(profile) }),
      });
      return res.ok;
    } catch (e) {
      console.error('[Firestore] Error saving business profile:', e);
      return false;
    }
  }

  // --- 2. USERS (STAFF) ---
  public async getUsers(): Promise<User[]> {
    const bizId = this.getBusinessId();
    if (!bizId) return [];

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}/users`;
    try {
      const res = await fetch(endpoint);
      if (!res.ok) return [];
      const data = await res.json();
      const documents = data.documents || [];
      return documents.map((doc: any) => {
        const id = doc.name.split('/').pop();
        const raw = fromFirestoreFields(doc.fields || {});
        return {
          id: raw.id || id,
          name: raw.name || 'Staff Member',
          email: raw.email || '',
          password: raw.password || raw.password_hash,
          phone: raw.phone || '',
          role: (raw.role as any) || 'USER',
          business_id: bizId,
          business_name: raw.business_name || '',
          hourly_wage: raw.hourly_wage !== undefined ? Number(raw.hourly_wage) : 52,
          charge_out_rate: raw.charge_out_rate !== undefined ? Number(raw.charge_out_rate) : 125,
          active: raw.active !== undefined ? Boolean(raw.active) : true,
          created_at: raw.created_at || doc.createTime || new Date().toISOString(),
        };
      });
    } catch (e) {
      console.warn(`[Firestore] Error fetching users for ${bizId}:`, e);
      return [];
    }
  }

  public async saveUser(user: User): Promise<boolean> {
    const bizId = user.business_id || this.getBusinessId();
    if (!bizId) return false;

    const userPayload: Record<string, any> = { ...user };
    
    // Encrypt/hash password if plain text is provided
    if (user.password && !user.password.startsWith('pbkdf2_sha256$')) {
      userPayload.password_hash = await hashPassword(user.password);
      delete userPayload.password;
    } else if (user.password_hash) {
      userPayload.password_hash = user.password_hash;
      delete userPayload.password;
    }

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}/users/${user.id}`;
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFirestoreFields(userPayload) }),
      });
      return res.ok;
    } catch (e) {
      console.error('[Firestore] Error saving user:', e);
      return false;
    }
  }

  // --- 3. PROJECTS & VOICE NOTES ---
  public async getProjects(): Promise<Project[]> {
    const bizId = this.getBusinessId();
    if (!bizId) return [];

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}/projects`;
    try {
      const res = await fetch(endpoint);
      if (!res.ok) return [];
      const data = await res.json();
      const documents = data.documents || [];

      const allNotes = await this.getVoiceNotes();

      return documents.map((doc: any) => {
        const id = doc.name.split('/').pop();
        const raw = fromFirestoreFields(doc.fields || {});
        const projectNotes = allNotes.filter(
          (n) => n.project_id === id || n.project_name?.toLowerCase() === raw.name?.toLowerCase()
        );

        return {
          id: raw.id || id,
          business_id: bizId,
          name: raw.name || 'Unnamed Project',
          client_name: raw.client_name || 'Direct Client',
          client_email: raw.client_email,
          client_phone: raw.client_phone,
          client_abn: raw.client_abn,
          site_address: raw.address || raw.site_address || 'On-Site',
          latitude: raw.latitude,
          longitude: raw.longitude,
          status: (raw.status as any) || 'IN_PROGRESS',
          assigned_user_ids: raw.assigned_user_ids || [],
          assigned_user_names: raw.assigned_user_names || [],
          estimated_hours: raw.estimated_hours ? Number(raw.estimated_hours) : 0,
          logged_hours: raw.logged_hours ? Number(raw.logged_hours) : 0,
          created_at: raw.created_at || doc.createTime || new Date().toISOString(),
          updated_at: raw.updated_at || doc.updateTime || new Date().toISOString(),
          voice_logs: projectNotes,
        };
      });
    } catch (e) {
      console.warn(`[Firestore] Error fetching projects for ${bizId}:`, e);
      return [];
    }
  }

  public async getVoiceNotes(): Promise<VoiceLog[]> {
    const bizId = this.getBusinessId();
    if (!bizId) return [];

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}/notes`;
    try {
      const res = await fetch(endpoint);
      if (!res.ok) return [];
      const data = await res.json();
      const documents = data.documents || [];

      return documents.map((doc: any) => {
        const id = doc.name.split('/').pop();
        const raw = fromFirestoreFields(doc.fields || {});

        let actionItems: string[] = [];
        if (Array.isArray(raw.action_items)) {
          actionItems = raw.action_items;
        } else if (typeof raw.action_items === 'string') {
          try {
            actionItems = JSON.parse(raw.action_items);
          } catch {
            actionItems = raw.action_items.split(';').map((s: string) => s.trim()).filter(Boolean);
          }
        }

        let extractedMaterials: ExtractedMaterial[] = [];
        if (Array.isArray(raw.extracted_materials)) {
          extractedMaterials = raw.extracted_materials;
        } else if (typeof raw.extracted_materials === 'string') {
          try {
            extractedMaterials = JSON.parse(raw.extracted_materials);
          } catch {}
        }

        return {
          id: raw.id || id,
          project_id: raw.matched_project_id || raw.project_id || '',
          project_name: raw.project_name || '',
          user_id: raw.user_id || '',
          user_name: raw.user_name || '',
          workflow_id: raw.workflow_id || 'workflow_voice_note',
          workflow_title: raw.workflow_title || 'Voice Note',
          timestamp: raw.timestamp || doc.createTime || new Date().toISOString(),
          raw_transcript: raw.raw_transcript || '',
          summary: raw.summary || raw.raw_transcript || '',
          audio_url: raw.firebase_storage_url || raw.audio_file_path || '',
          latitude: raw.latitude,
          longitude: raw.longitude,
          location_address: raw.location_address || raw.address,
          action_items: actionItems,
          extracted_materials: extractedMaterials,
          sync_status: (raw.sync_status as any) || 'SYNCED',
          firestore_id: id,
        };
      });
    } catch (e) {
      console.warn(`[Firestore] Error fetching voice notes for ${bizId}:`, e);
      return [];
    }
  }

  public async saveProject(project: Project): Promise<boolean> {
    const bizId = project.business_id || this.getBusinessId();
    if (!bizId) return false;

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}/projects/${project.id}`;
    try {
      const payload: Record<string, any> = {
        name: project.name,
        client_name: project.client_name,
        site_address: project.site_address,
        status: project.status,
        business_id: bizId,
        assigned_user_ids: project.assigned_user_ids || [],
        assigned_user_names: project.assigned_user_names || [],
        estimated_hours: project.estimated_hours || 0,
        logged_hours: project.logged_hours || 0,
        created_at: project.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (project.client_email) payload.client_email = project.client_email;
      if (project.client_phone) payload.client_phone = project.client_phone;
      if (project.client_abn) payload.client_abn = project.client_abn;
      if (project.latitude) payload.latitude = project.latitude;
      if (project.longitude) payload.longitude = project.longitude;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFirestoreFields(payload) }),
      });
      return res.ok;
    } catch (e) {
      console.error('[Firestore] Error saving project:', e);
      return false;
    }
  }

  public async updateVoiceNote(noteId: string, updates: Partial<VoiceLog>): Promise<boolean> {
    const bizId = this.getBusinessId();
    if (!bizId) return false;

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}/notes/${noteId}`;
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFirestoreFields(updates) }),
      });
      return res.ok;
    } catch (e) {
      console.error('[Firestore] Error updating voice note:', e);
      return false;
    }
  }

  // --- 4. INVENTORY ---
  public async getInventory(): Promise<InventoryItem[]> {
    const bizId = this.getBusinessId();
    if (!bizId) return [];

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}/inventory`;
    try {
      const res = await fetch(endpoint);
      if (!res.ok) return [];
      const data = await res.json();
      const documents = data.documents || [];

      return documents.map((doc: any) => {
        const id = doc.name.split('/').pop();
        const raw = fromFirestoreFields(doc.fields || {});
        const cost = raw.cost_price ? Number(raw.cost_price) : 0;
        const sell = raw.sell_price ? Number(raw.sell_price) : 0;
        const markup = cost > 0 ? Number((((sell - cost) / cost) * 100).toFixed(1)) : 0;

        return {
          id: raw.id || id,
          business_id: bizId,
          sku: raw.sku || id,
          name: raw.name || 'Item',
          category: raw.category || 'General',
          stock_quantity: raw.stock_quantity !== undefined ? Number(raw.stock_quantity) : 0,
          low_stock_threshold: raw.low_stock_threshold !== undefined ? Number(raw.low_stock_threshold) : 5,
          unit: raw.unit || 'pcs',
          cost_price: cost,
          sell_price: sell,
          markup_percent: raw.markup_percent !== undefined ? Number(raw.markup_percent) : markup,
          location_bin: raw.location_bin,
          updated_at: raw.updated_at || doc.updateTime || new Date().toISOString(),
        };
      });
    } catch (e) {
      console.warn(`[Firestore] Error fetching inventory for ${bizId}:`, e);
      return [];
    }
  }

  public async saveInventoryItem(item: InventoryItem): Promise<boolean> {
    const bizId = item.business_id || this.getBusinessId();
    if (!bizId) return false;

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}/inventory/${item.id}`;
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFirestoreFields(item) }),
      });
      return res.ok;
    } catch (e) {
      console.error('[Firestore] Error saving inventory item:', e);
      return false;
    }
  }

  // --- 5. ATO TAX INVOICES ---
  public async getInvoices(): Promise<TaxInvoice[]> {
    const bizId = this.getBusinessId();
    if (!bizId) return [];

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}/invoices`;
    try {
      const res = await fetch(endpoint);
      if (!res.ok) return [];
      const data = await res.json();
      const documents = data.documents || [];

      return documents.map((doc: any) => {
        const id = doc.name.split('/').pop();
        const raw = fromFirestoreFields(doc.fields || {});

        return {
          id: raw.id || id,
          invoice_number: raw.invoice_number || `INV-${id}`,
          business_id: bizId,
          project_id: raw.project_id,
          project_name: raw.project_name || 'Project',
          status: (raw.status as any) || 'DRAFT',
          issue_date: raw.issue_date || new Date().toISOString(),
          due_date: raw.due_date || new Date(Date.now() + 14 * 86400000).toISOString(),
          payment_terms: raw.payment_terms || '14 Days from date of invoice',
          seller: (raw.seller as any) || {},
          buyer: (raw.buyer as any) || {
            name: 'Client Accounts',
            address: 'Site Address',
          },
          line_items: (raw.line_items as any) || [],
          subtotal_ex_gst: raw.subtotal_ex_gst ? Number(raw.subtotal_ex_gst) : 0,
          total_gst: raw.total_gst ? Number(raw.total_gst) : 0,
          total_inc_gst: raw.total_inc_gst ? Number(raw.total_inc_gst) : 0,
          amount_paid: raw.amount_paid ? Number(raw.amount_paid) : 0,
          balance_due: raw.balance_due ? Number(raw.balance_due) : 0,
          notes: raw.notes || 'Thank you for your business.',
          created_at: raw.created_at || doc.createTime || new Date().toISOString(),
          updated_at: raw.updated_at || doc.updateTime || new Date().toISOString(),
        };
      });
    } catch (e) {
      console.warn(`[Firestore] Error fetching invoices for ${bizId}:`, e);
      return [];
    }
  }

  public async saveInvoice(invoice: TaxInvoice): Promise<boolean> {
    const bizId = invoice.business_id || this.getBusinessId();
    if (!bizId) return false;

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}/invoices/${invoice.id}`;
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFirestoreFields(invoice) }),
      });
      return res.ok;
    } catch (e) {
      console.error('[Firestore] Error saving invoice:', e);
      return false;
    }
  }
}

export const firestoreDashboardService = FirestoreDashboardService.getInstance();
