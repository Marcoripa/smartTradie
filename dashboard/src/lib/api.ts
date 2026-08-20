import { Project, VoiceLog, ExtractedMaterial } from '../types/project';
import { InventoryItem, StockAuditLog } from '../types/inventory';
import { User, AuthResponse } from '../types/auth';
import { TaxInvoice, InvoiceLineItem, BusinessSellerProfile } from '../types/invoice';
import { firestoreDashboardService } from './firestoreService';
import { verifyPassword, hashPassword } from './cryptoUtils';

class ApiClient {
  private token: string | null = null;
  private currentUser: User | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('smart_tradie_auth_token');
      const savedUser = localStorage.getItem('smart_tradie_user');
      if (savedUser) {
        try {
          this.currentUser = JSON.parse(savedUser);
          if (this.currentUser?.business_id) {
            firestoreDashboardService.setBusinessId(this.currentUser.business_id);
          }
        } catch {}
      }
    }
  }

  private getApiUrl(): string {
    if (typeof window !== 'undefined') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    }
    return process.env.BACKEND_API_URL || 'http://127.0.0.1:8000';
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('smart_tradie_auth_token', token);
      } else {
        localStorage.removeItem('smart_tradie_auth_token');
      }
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public setCurrentUser(user: User | null) {
    this.currentUser = user;
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('smart_tradie_user', JSON.stringify(user));
        if (user.business_id) {
          firestoreDashboardService.setBusinessId(user.business_id);
        }
      } else {
        localStorage.removeItem('smart_tradie_user');
      }
    }
  }

  // --- 1. REAL AUTHENTICATION ---
  public async login(email: string, password?: string): Promise<AuthResponse> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) {
      throw new Error('Email is required.');
    }

    // 1. Try Backend Authentication endpoint (with full GCP token & ADC support)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        const user: User = data.user;
        if (user.business_id) {
          firestoreDashboardService.setBusinessId(user.business_id);
        }
        this.setToken(data.access_token);
        this.setCurrentUser(user);
        return {
          access_token: data.access_token,
          token_type: data.token_type || 'Bearer',
          user,
        };
      } else if (res.status === 401 || res.status === 400) {
        throw new Error(data.detail || 'Authentication failed. Please check your credentials.');
      }
    } catch (e: any) {
      if (e.message && !e.message.includes('fetch')) {
        throw e;
      }
    }

    // 2. Fallback to direct browser Firestore REST API
    const matchedUser = await firestoreDashboardService.findUserByEmail(cleanEmail);

    if (!matchedUser) {
      throw new Error(`No account found for "${cleanEmail}". Please check your email or contact your administrator.`);
    }

    // Cryptographic Password Verification
    const storedSecret = matchedUser.password_hash || matchedUser.password;
    if (storedSecret) {
      if (!password) {
        throw new Error('Password is required.');
      }
      const isValid = await verifyPassword(password, storedSecret);
      if (!isValid) {
        throw new Error('Incorrect password. Please verify your credentials.');
      }

      // If password was stored unencrypted/legacy, automatically upgrade to encrypted PBKDF2 hash
      if (!storedSecret.startsWith('pbkdf2_sha256$')) {
        try {
          const newHash = await hashPassword(password);
          await firestoreDashboardService.saveUser({
            ...matchedUser,
            password_hash: newHash,
          });
        } catch {}
      }
    }

    // Set dynamic business_id from user's Firestore record
    if (matchedUser.business_id) {
      firestoreDashboardService.setBusinessId(matchedUser.business_id);
    } else {
      throw new Error('User account is missing a valid business_id in Firestore.');
    }

    // Fetch the real business profile from Firestore
    const businessProfile = await this.getBusinessProfile();
    if (businessProfile?.business_name) {
      matchedUser.business_name = businessProfile.business_name;
    }

    const authResp: AuthResponse = {
      access_token: `jwt_bearer_${matchedUser.id}_${Date.now()}`,
      token_type: 'Bearer',
      user: matchedUser,
    };

    this.setToken(authResp.access_token);
    this.setCurrentUser(matchedUser);
    return authResp;
  }

  public async getMe(): Promise<User | null> {
    return this.currentUser;
  }

  // --- 2. BUSINESS PROFILE ---
  public async getBusinessProfile(): Promise<BusinessSellerProfile | null> {
    const bizId = firestoreDashboardService.getBusinessId();
    if (!bizId) return null;

    try {
      const res = await fetch(`${this.getApiUrl()}/api/v1/businesses/${bizId}`);
      if (res.ok) {
        const raw = await res.json();
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
      }
    } catch {}

    return await firestoreDashboardService.getBusinessProfile();
  }

  // --- 3. USERS & STAFF ---
  public async getUsers(): Promise<User[]> {
    const bizId = firestoreDashboardService.getBusinessId();
    if (!bizId) return [];

    try {
      const res = await fetch(`${this.getApiUrl()}/api/v1/admin/users?business_id=${bizId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    return await firestoreDashboardService.getUsers();
  }

  public async createUser(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const bizId = user.business_id || firestoreDashboardService.getBusinessId();
    const newUser: User = {
      ...user,
      id: `usr_${Date.now()}`,
      business_id: bizId,
      created_at: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${this.getApiUrl()}/api/v1/admin/users?business_id=${bizId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    await firestoreDashboardService.saveUser(newUser);
    return newUser;
  }

  public async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const bizId = firestoreDashboardService.getBusinessId();
    try {
      const res = await fetch(`${this.getApiUrl()}/api/v1/admin/users/${id}?business_id=${bizId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        if (this.currentUser?.id === id) {
          this.setCurrentUser(updated);
        }
        return updated;
      }
    } catch {}

    const users = await this.getUsers();
    const current = users.find((u) => u.id === id);
    if (!current) return null;

    const updated = { ...current, ...updates };
    await firestoreDashboardService.saveUser(updated);
    if (this.currentUser?.id === id) {
      this.setCurrentUser(updated);
    }
    return updated;
  }

  // --- 4. PROJECTS & VOICE NOTES ---
  public async getProjects(): Promise<Project[]> {
    const bizId = firestoreDashboardService.getBusinessId();
    if (!bizId) return [];

    try {
      console.log(`${this.getApiUrl()}/api/v1/projects?business_id=${bizId}`)
      const res = await fetch(`${this.getApiUrl()}/api/v1/projects?business_id=${bizId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    return await firestoreDashboardService.getProjects();
  }

  public async getProjectById(id: string): Promise<Project | null> {
    const projects = await this.getProjects();
    return projects.find((p) => p.id === id) || null;
  }

  public async createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const bizId = project.business_id || firestoreDashboardService.getBusinessId();
    const newProject: Project = {
      ...project,
      id: `proj_${Date.now()}`,
      business_id: bizId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      voice_logs: [],
    };

    try {
      const res = await fetch(`${this.getApiUrl()}/api/v1/projects?business_id=${bizId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    await firestoreDashboardService.saveProject(newProject);
    return newProject;
  }

  public async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    const bizId = firestoreDashboardService.getBusinessId();
    try {
      const res = await fetch(`${this.getApiUrl()}/api/v1/projects/${id}?business_id=${bizId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    const projects = await this.getProjects();
    const current = projects.find((p) => p.id === id);
    if (!current) return null;

    const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
    await firestoreDashboardService.saveProject(updated);
    return updated;
  }

  public async approveMaterial(
    projectId: string,
    voiceLogId: string,
    materialId: string,
    deductInventory = true
  ): Promise<boolean> {
    const bizId = firestoreDashboardService.getBusinessId();
    try {
      const res = await fetch(`${this.getApiUrl()}/api/v1/projects/${projectId}/materials/approve?business_id=${bizId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_log_id: voiceLogId,
          material_id: materialId,
          deduct_inventory: deductInventory,
        }),
      });
      if (res.ok) {
        return true;
      }
    } catch {}

    const project = await this.getProjectById(projectId);
    if (!project || !project.voice_logs) return false;

    const log = project.voice_logs.find((l) => l.id === voiceLogId);
    if (!log) return false;

    const mat = log.extracted_materials.find((m) => m.id === materialId);
    if (!mat) return false;

    mat.approved = true;
    if (deductInventory && !mat.inventory_deducted && mat.matched_inventory_sku) {
      const inventory = await this.getInventory();
      const item = inventory.find((i) => i.sku === mat.matched_inventory_sku);
      if (item) {
        item.stock_quantity = Math.max(0, item.stock_quantity - mat.quantity);
        mat.inventory_deducted = true;
        await firestoreDashboardService.saveInventoryItem(item);
      }
    }

    await firestoreDashboardService.updateVoiceNote(log.id, {
      extracted_materials: log.extracted_materials,
    });
    return true;
  }

  // --- 5. INVENTORY ---
  public async getInventory(): Promise<InventoryItem[]> {
    const bizId = firestoreDashboardService.getBusinessId();
    if (!bizId) return [];

    try {
      const res = await fetch(`${this.getApiUrl()}/api/v1/inventory?business_id=${bizId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    return await firestoreDashboardService.getInventory();
  }

  public async getStockAudits(): Promise<StockAuditLog[]> {
    const notes = await firestoreDashboardService.getVoiceNotes();
    const audits: StockAuditLog[] = [];

    for (const note of notes) {
      for (const mat of note.extracted_materials || []) {
        if (mat.inventory_deducted) {
          audits.push({
            id: `aud_${note.id}_${mat.id}`,
            inventory_item_id: mat.matched_inventory_sku || mat.id,
            item_name: mat.item_name,
            sku: mat.matched_inventory_sku || 'N/A',
            quantity_changed: -mat.quantity,
            previous_stock: 0,
            new_stock: 0,
            reason: 'PROJECT_VOICE_DEDUCTION',
            project_id: note.project_id,
            project_name: note.project_name,
            voice_log_id: note.id,
            user_name: note.user_name,
            timestamp: note.timestamp,
          });
        }
      }
    }
    return audits;
  }

  public async createInventoryItem(item: Omit<InventoryItem, 'id' | 'updated_at' | 'markup_percent'>): Promise<InventoryItem> {
    const bizId = item.business_id || firestoreDashboardService.getBusinessId();
    const markup = item.cost_price > 0
      ? Number((((item.sell_price - item.cost_price) / item.cost_price) * 100).toFixed(1))
      : 0;

    const newItem: InventoryItem = {
      ...item,
      id: item.sku || `inv_${Date.now()}`,
      business_id: bizId,
      markup_percent: markup,
      updated_at: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${this.getApiUrl()}/api/v1/inventory?business_id=${bizId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    await firestoreDashboardService.saveInventoryItem(newItem);
    return newItem;
  }

  public async updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | null> {
    const bizId = firestoreDashboardService.getBusinessId();
    try {
      const res = await fetch(`${this.getApiUrl()}/api/v1/inventory/${id}?business_id=${bizId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    const items = await this.getInventory();
    const current = items.find((i) => i.id === id);
    if (!current) return null;

    const cost = updates.cost_price !== undefined ? updates.cost_price : current.cost_price;
    const sell = updates.sell_price !== undefined ? updates.sell_price : current.sell_price;
    const markup = cost > 0 ? Number((((sell - cost) / cost) * 100).toFixed(1)) : 0;

    const updated: InventoryItem = {
      ...current,
      ...updates,
      markup_percent: markup,
      updated_at: new Date().toISOString(),
    };
    await firestoreDashboardService.saveInventoryItem(updated);
    return updated;
  }

  // --- 6. ATO TAX INVOICES ---
  public async getInvoices(): Promise<TaxInvoice[]> {
    const bizId = firestoreDashboardService.getBusinessId();
    if (!bizId) return [];

    try {
      const res = await fetch(`${this.getApiUrl()}/api/v1/invoices?business_id=${bizId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    return await firestoreDashboardService.getInvoices();
  }

  public async getInvoiceById(id: string): Promise<TaxInvoice | null> {
    const invoices = await this.getInvoices();
    return invoices.find((inv) => inv.id === id) || null;
  }

  public async createInvoice(invoice: Omit<TaxInvoice, 'id' | 'created_at' | 'updated_at'>): Promise<TaxInvoice> {
    const bizId = invoice.business_id || firestoreDashboardService.getBusinessId();
    const newInvoice: TaxInvoice = {
      ...invoice,
      id: `inv_${Date.now()}`,
      business_id: bizId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${this.getApiUrl()}/api/v1/invoices?business_id=${bizId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInvoice),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    await firestoreDashboardService.saveInvoice(newInvoice);
    return newInvoice;
  }

  public async generateInvoiceFromProject(projectId: string): Promise<TaxInvoice | null> {
    const bizId = firestoreDashboardService.getBusinessId();
    try {
      const res = await fetch(`${this.getApiUrl()}/api/v1/invoices/generate-from-project/${projectId}?business_id=${bizId}`, {
        method: 'POST',
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    const project = await this.getProjectById(projectId);
    if (!project) return null;

    const sellerProfile = await this.getBusinessProfile();
    if (!sellerProfile) {
      throw new Error('Please configure your Business Profile before generating tax invoices.');
    }

    const lineItems: InvoiceLineItem[] = [];

    if (project.voice_logs && project.voice_logs.length > 0) {
      for (const log of project.voice_logs) {
        for (const mat of log.extracted_materials || []) {
          if (mat.approved) {
            const subtotal = mat.quantity * mat.sell_price;
            const gst = subtotal * 0.10;
            lineItems.push({
              id: `li_${Date.now()}_${mat.id}`,
              description: `${mat.item_name} (Voice Verified on-site)`,
              quantity: mat.quantity,
              unit: mat.unit,
              unit_price: mat.sell_price,
              is_gst_taxable: true,
              line_subtotal: subtotal,
              line_gst: gst,
              line_total: subtotal + gst,
              item_type: 'MATERIAL',
              inventory_sku: mat.matched_inventory_sku,
            });
          }
        }
      }
    }

    const hours = project.logged_hours || project.estimated_hours || 0;
    const rate = 125.0;
    const laborSubtotal = hours * rate;
    const laborGst = laborSubtotal * 0.10;

    if (hours > 0) {
      lineItems.unshift({
        id: `li_${Date.now()}_labor`,
        description: `Trade Labor Services (${hours} hrs logged on-site)`,
        quantity: hours,
        unit: 'hours',
        unit_price: rate,
        is_gst_taxable: true,
        line_subtotal: laborSubtotal,
        line_gst: laborGst,
        line_total: laborSubtotal + laborGst,
        item_type: 'LABOR',
      });
    }

    const subtotalExGst = lineItems.reduce((acc, item) => acc + item.line_subtotal, 0);
    const totalGst = lineItems.reduce((acc, item) => acc + item.line_gst, 0);
    const totalIncGst = subtotalExGst + totalGst;

    const allInvoices = await this.getInvoices();
    const invoiceNumber = `INV-2026-${String(allInvoices.length + 1).padStart(4, '0')}`;

    const newInvoice: TaxInvoice = {
      id: `inv_${Date.now()}`,
      invoice_number: invoiceNumber,
      business_id: bizId,
      project_id: project.id,
      project_name: project.name,
      status: 'DRAFT',
      issue_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      payment_terms: '14 Days from date of invoice',
      seller: sellerProfile,
      buyer: {
        name: `${project.client_name} Accounts`,
        company_name: project.client_name,
        abn: project.client_abn,
        address: project.site_address,
        email: project.client_email,
        phone: project.client_phone,
      },
      line_items: lineItems,
      subtotal_ex_gst: subtotalExGst,
      total_gst: totalGst,
      total_inc_gst: totalIncGst,
      amount_paid: 0,
      balance_due: totalIncGst,
      notes: 'Thank you for your business. Please quote invoice number when making electronic transfer.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.createInvoice(newInvoice);
    await this.updateProject(projectId, { status: 'INVOICED' });
    return newInvoice;
  }
}

export const api = new ApiClient();
