import { ProjectRecord, NoteQueueRecord } from './SQLiteQueueService';
import { appConfigService } from '../config/appConfig';

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
  businessId: 'biz_apex_mining',
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
    return `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/${dbName}/documents`;
  }

  /**
   * Save a project to Firestore scoped under the business ID:
   * /businesses/{businessId}/projects/{projectId}
   */
  public async saveProjectToFirestore(project: ProjectRecord): Promise<{ success: boolean; firestoreId?: string }> {
    const bizId = this.getBusinessId();
    console.log(`[FirestoreService] Saving project to Firestore (Biz: ${bizId}, DB: ${this.config.databaseId}):`, project);

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}/projects/${project.id}`;

    const fields: any = {
      name: { stringValue: project.name },
      business_id: { stringValue: bizId },
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[FirestoreService] Firestore response status ${response.status}: ${errText}`);
        return { success: false };
      }

      const data = await response.json();
      console.log(`[FirestoreService] Project saved to Firestore business '${bizId}' successfully! ID: ${project.id}`);
      return { success: true, firestoreId: data.name || project.id };
    } catch (error) {
      console.warn('[FirestoreService] Network error saving project to Firestore (will queue in SQLite):', error);
      return { success: false };
    }
  }

  /**
   * Fetch all projects scoped under the business ID from Firestore
   */
  public async fetchProjectsFromFirestore(): Promise<ProjectRecord[]> {
    const bizId = this.getBusinessId();
    console.log(`[FirestoreService] Fetching projects for business ${bizId} (DB: ${this.config.databaseId})...`);
    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}/projects`;

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
          created_at: f.created_at?.stringValue || new Date().toISOString(),
          synced: 1,
          latitude: f.latitude?.doubleValue,
          longitude: f.longitude?.doubleValue,
          address: f.address?.stringValue,
        };
      });
    } catch (e) {
      console.warn('[FirestoreService] Failed to fetch remote projects, falling back to SQLite:', e);
      return [];
    }
  }

  /**
   * Save a voice note / workflow log to Firestore scoped under the business ID:
   * /businesses/{businessId}/notes/{noteId}
   */
  public async saveNoteToFirestore(note: NoteQueueRecord, audioStorageUrl?: string): Promise<{ success: boolean; firestoreId?: string }> {
    const bizId = this.getBusinessId();
    console.log(`[FirestoreService] Saving note ${note.id} for business ${bizId} (DB: ${this.config.databaseId})...`);

    const endpoint = `${this.getBaseUrl()}/businesses/${bizId}/notes/${note.id}`;

    let parsedActionItems: string[] = [];
    try {
      parsedActionItems = JSON.parse(note.action_items);
    } catch {
      parsedActionItems = note.action_items ? [note.action_items] : [];
    }

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
        const err = await response.text();
        console.warn(`[FirestoreService] Save note error ${response.status}: ${err}`);
        return { success: false };
      }

      const data = await response.json();
      return { success: true, firestoreId: data.name || note.id };
    } catch (error) {
      console.warn('[FirestoreService] Network error saving note to Firestore:', error);
      return { success: false };
    }
  }
}

export const firestoreService = FirestoreService.getInstance();
