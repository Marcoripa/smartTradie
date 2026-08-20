import { ProjectRecord, NoteQueueRecord } from './SQLiteQueueService';
import { appConfigService } from '../config/appConfig';
import { getBackendUrl } from './sync';

export interface FirestoreConfig {
  projectId: string;
  databaseId: string;
  businessId?: string;
  apiKey?: string;
  storageBucket?: string;
}

// Config matching your Google Cloud Project, Firestore database, and Business ID
export const defaultFirestoreConfig: FirestoreConfig = {
  projectId: 'smarttradie-505506',
  databaseId: 'smart-tradie',
  businessId: '',
  storageBucket: 'smart-tradie',
};

export class FirestoreService {
  private static instance: FirestoreService;
  private config: FirestoreConfig = defaultFirestoreConfig;

  private constructor() {}

  public static getInstance(): FirestoreService {
    if (!FirestoreService.instance) {
      FirestoreService.instance = new FirestoreService();
    }
    return FirestoreService.instance;
  }

  public setConfig(config: Partial<FirestoreConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`[FirestoreService] Updated config for project: ${this.config.projectId}, db: ${this.config.databaseId}, biz: ${this.getBusinessId()}`);
  }

  public getConfig(): FirestoreConfig {
    return this.config;
  }

  public getBusinessId(): string {
    return this.config.businessId || appConfigService.getBusinessId();
  }

  private getBaseUrl(): string {
    const dbName = this.config.databaseId || 'smart-tradie';
    const base = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/${dbName}/documents`;
    return this.config.apiKey ? `${base}?key=${this.config.apiKey}` : base;
  }

  /**
   * Save a project to Firestore scoped under the business ID
   */
  public async saveProjectToFirestore(project: ProjectRecord): Promise<{ success: boolean; firestoreId?: string }> {
    const bizId = this.getBusinessId();
    console.log(`[FirestoreService] Saving project to Firestore (Biz: ${bizId}):`, project);

    // 1. Primary: Save via authenticated Backend API proxy
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/v1/projects?business_id=${bizId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: project.id,
          name: project.name,
          business_id: bizId,
          status: project.status || 'in progress',
          created_by_user_id: appConfigService.getUserId(),
          created_by_user_name: appConfigService.getUserName(),
          created_at: project.created_at || new Date().toISOString(),
          synced_at: new Date().toISOString(),
          latitude: project.latitude,
          longitude: project.longitude,
          address: project.address,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`[FirestoreService] Project saved via backend API for business '${bizId}'! ID: ${project.id}`);
        return { success: true, firestoreId: data.id || project.id };
      }
    } catch (e) {
      console.log('[FirestoreService] Backend proxy unavailable for project save');
    }

    // 2. Direct Firestore REST fallback (only if API Key is configured)
    if (!this.config.apiKey) {
      return { success: false };
    }

    const endpoint = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/${this.config.databaseId || 'smart-tradie'}/documents/businesses/${bizId}/projects/${project.id}?key=${this.config.apiKey}`;
    const fields: any = {
      name: { stringValue: project.name },
      business_id: { stringValue: bizId },
      status: { stringValue: project.status || 'in progress' },
      created_by_user_id: { stringValue: appConfigService.getUserId() },
      created_by_user_name: { stringValue: appConfigService.getUserName() },
      created_at: { stringValue: project.created_at || new Date().toISOString() },
      synced_at: { stringValue: new Date().toISOString() },
    };

    if (project.latitude !== undefined && project.latitude !== null) {
      fields.latitude = { doubleValue: project.latitude };
    }
    if (project.longitude !== undefined && project.longitude !== null) {
      fields.longitude = { doubleValue: project.longitude };
    }
    if (project.address) {
      fields.address = { stringValue: project.address };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });

      if (!response.ok) {
        return { success: false };
      }

      const data = await response.json();
      return { success: true, firestoreId: data.name || project.id };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Fetch all projects scoped under the business ID from Firestore
   */
  public async fetchProjectsFromFirestore(): Promise<ProjectRecord[]> {
    const bizId = this.getBusinessId();

    // 1. Primary: Fetch via authenticated Backend API (uses GCP ADC / Service Account)
    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/v1/projects?business_id=${bizId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          console.log(`[FirestoreService] Fetched ${data.length} projects via backend API for business ${bizId}`);
          return data.map((p: any) => ({
            id: p.id || p._firestore_id,
            name: p.name || 'Untitled Project',
            business_id: p.business_id || bizId,
            status: p.status || 'in progress',
            created_at: p.created_at || new Date().toISOString(),
            synced: 1,
            latitude: p.latitude,
            longitude: p.longitude,
            address: p.address || p.site_address,
          }));
        }
      }
    } catch (e) {
      // Backend not running / offline -> SQLite will serve offline projects
    }

    // 2. Direct Firestore REST fallback (only if API Key is configured)
    if (!this.config.apiKey) {
      return [];
    }

    const endpoint = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/${this.config.databaseId || 'smart-tradie'}/documents/businesses/${bizId}/projects?key=${this.config.apiKey}`;
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      if (!data.documents || !Array.isArray(data.documents)) {
        return [];
      }

      return data.documents.map((doc: any) => {
        const id = doc.name.split('/').pop();
        const f = doc.fields || {};
        return {
          id,
          name: f.name?.stringValue || 'Untitled Project',
          business_id: f.business_id?.stringValue || bizId,
          status: f.status?.stringValue || 'in progress',
          created_at: f.created_at?.stringValue || new Date().toISOString(),
          synced: 1,
          latitude: f.latitude?.doubleValue,
          longitude: f.longitude?.doubleValue,
          address: f.address?.stringValue,
        };
      });
    } catch (e) {
      return [];
    }
  }

  /**
   * Save a voice note / workflow log to Firestore scoped under the business ID
   */
  public async saveNoteToFirestore(note: NoteQueueRecord, audioStorageUrl?: string): Promise<{ success: boolean; firestoreId?: string }> {
    const bizId = this.getBusinessId();
    console.log(`[FirestoreService] Saving note ${note.id} for business ${bizId}...`);

    let parsedActionItems: string[] = [];
    try {
      parsedActionItems = JSON.parse(note.action_items);
    } catch {
      parsedActionItems = note.action_items ? [note.action_items] : [];
    }

    // 1. Primary: Save via authenticated Backend API proxy
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/v1/notes/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          local_id: note.id,
          business_id: bizId,
          user_id: note.user_id || appConfigService.getUserId(),
          user_name: note.user_name || appConfigService.getUserName(),
          project_id: note.matched_project_id || '',
          client_audio_path: note.audio_file_path || '',
          content_audio_path: note.audio_file_path || '',
          actions_audio_path: note.audio_file_path || '',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, firestoreId: data.id || note.id };
      }
    } catch (e) {
      console.log('[FirestoreService] Backend unavailable for note process');
    }

    // 2. Direct Firestore REST fallback (only if API Key is configured)
    if (!this.config.apiKey) {
      return { success: false };
    }

    const endpoint = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/${this.config.databaseId || 'smart-tradie'}/documents/businesses/${bizId}/notes/${note.id}?key=${this.config.apiKey}`;
    const fields: any = {
      business_id: { stringValue: bizId },
      user_id: { stringValue: note.user_id || appConfigService.getUserId() },
      user_name: { stringValue: note.user_name || appConfigService.getUserName() },
      workflow_id: { stringValue: note.workflow_id || 'workflow_voice_note' },
      workflow_title: { stringValue: note.workflow_title || 'Field Engineering Note' },
      project_name: { stringValue: note.project_name },
      is_new_project: { booleanValue: Boolean(note.is_new_project) },
      project_status: { stringValue: note.project_status },
      raw_transcript: { stringValue: note.raw_transcript },
      action_items: {
        arrayValue: {
          values: parsedActionItems.map((act) => ({ stringValue: act })),
        },
      },
      timestamp: { stringValue: note.timestamp },
      synced_at: { stringValue: new Date().toISOString() },
    };

    if (note.structured_data) {
      fields.structured_data = { stringValue: note.structured_data };
    }
    if (note.matched_project_id) {
      fields.matched_project_id = { stringValue: note.matched_project_id };
    }
    if (note.latitude !== undefined && note.latitude !== null) {
      fields.latitude = { doubleValue: note.latitude };
    }
    if (note.longitude !== undefined && note.longitude !== null) {
      fields.longitude = { doubleValue: note.longitude };
    }
    if (note.location_address) {
      fields.location_address = { stringValue: note.location_address };
    }
    if (note.location_type) {
      fields.location_type = { stringValue: note.location_type };
    }
    if (audioStorageUrl || note.firebase_storage_url) {
      fields.audio_storage_url = { stringValue: audioStorageUrl || note.firebase_storage_url || '' };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });

      if (!response.ok) {
        return { success: false };
      }

      const data = await response.json();
      return { success: true, firestoreId: data.name || note.id };
    } catch (error) {
      return { success: false };
    }
  }
}

export const firestoreService = FirestoreService.getInstance();
