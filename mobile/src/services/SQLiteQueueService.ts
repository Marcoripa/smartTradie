import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { appConfigService } from '../config/appConfig';
import { ProjectMatcher, ProjectMatchResult } from './ProjectMatcher';

export type SyncStatus = 'PENDING_SYNC' | 'SYNCING' | 'SYNCED';
export type ProjectResolutionStatus = 'NEW_PROJECT' | 'MATCHED' | 'EXISTING_PENDING_MATCH';

export interface ProjectRecord {
  id: string;
  name: string;
  business_id?: string;
  status?: string;
  created_at: string;
  synced: number; // 0 for offline draft, 1 for synced to Firestore
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface NoteQueueRecord {
  id: string;
  timestamp: string;
  business_id?: string;
  user_id?: string;
  user_name?: string;
  workflow_id?: string;
  workflow_title?: string;
  project_name: string;
  is_new_project: boolean;
  project_status: ProjectResolutionStatus;
  matched_project_id?: string;
  latitude?: number;
  longitude?: number;
  location_address?: string;
  location_type?: string;
  raw_transcript: string;
  action_items: string; // JSON string array or structured extraction map
  structured_data?: string; // JSON string map of step results
  audio_file_path: string;
  sync_status: SyncStatus;
  firestore_doc_id?: string;
  firebase_storage_url?: string;
  error_message?: string;
}

const DB_NAME = 'smart_tradie_queue.db';
let db: SQLite.SQLiteDatabase | null = null;
const memoryNotesStore: Map<string, NoteQueueRecord> = new Map();
const memoryProjectsStore: Map<string, ProjectRecord> = new Map();

function persistWebStorage() {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('smart_tradie_notes', JSON.stringify(Array.from(memoryNotesStore.entries())));
      localStorage.setItem('smart_tradie_projects', JSON.stringify(Array.from(memoryProjectsStore.entries())));
    } catch {}
  }
}

function loadWebStorage() {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      const savedNotes = localStorage.getItem('smart_tradie_notes');
      if (savedNotes) {
        const entries: [string, NoteQueueRecord][] = JSON.parse(savedNotes);
        entries.forEach(([k, v]) => memoryNotesStore.set(k, v));
      }
      const savedProjects = localStorage.getItem('smart_tradie_projects');
      if (savedProjects) {
        const entries: [string, ProjectRecord][] = JSON.parse(savedProjects);
        entries.forEach(([k, v]) => memoryProjectsStore.set(k, v));
      }
    } catch {}
  }
}

export class SQLiteQueueService {
  private static instance: SQLiteQueueService;

  private constructor() {}

  public static getInstance(): SQLiteQueueService {
    if (!SQLiteQueueService.instance) {
      SQLiteQueueService.instance = new SQLiteQueueService();
    }
    return SQLiteQueueService.instance;
  }

  public async initQueueDatabase(): Promise<void> {
    if (Platform.OS === 'web') {
      loadWebStorage();
      console.log('[SQLiteQueueService] Web localStorage queue initialized.');
      return;
    }

    try {
      db = await SQLite.openDatabaseAsync(DB_NAME);
      
      // Notes & Workflow records table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY NOT NULL,
          timestamp TEXT NOT NULL,
          business_id TEXT,
          user_id TEXT,
          user_name TEXT,
          workflow_id TEXT DEFAULT 'workflow_voice_note',
          workflow_title TEXT DEFAULT 'Voice Note',
          project_name TEXT NOT NULL,
          is_new_project INTEGER NOT NULL DEFAULT 1,
          project_status TEXT NOT NULL DEFAULT 'NEW_PROJECT',
          matched_project_id TEXT,
          latitude REAL,
          longitude REAL,
          location_address TEXT,
          location_type TEXT,
          raw_transcript TEXT NOT NULL,
          action_items TEXT NOT NULL,
          structured_data TEXT,
          audio_file_path TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'PENDING_SYNC',
          firestore_doc_id TEXT,
          firebase_storage_url TEXT,
          error_message TEXT
        );
      `);

      // Projects cache table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          business_id TEXT,
          status TEXT DEFAULT 'IN_PROGRESS',
          created_at TEXT NOT NULL,
          synced INTEGER NOT NULL DEFAULT 0,
          latitude REAL,
          longitude REAL,
          address TEXT
        );
      `);

      console.log('[SQLiteQueueService] SQLite notes & projects tables ready.');
    } catch (error) {
      console.error('[SQLiteQueueService] Failed to initialize SQLite database:', error);
    }
  }

  /**
   * Returns all local cached projects
   */
  public async getAllProjects(): Promise<ProjectRecord[]> {
    if (Platform.OS === 'web' || !db) {
      return Array.from(memoryProjectsStore.values());
    }

    try {
      const rows = await db.getAllAsync<ProjectRecord>(
        `SELECT * FROM projects ORDER BY created_at DESC;`
      );
      return rows || [];
    } catch (e) {
      console.warn('[SQLiteQueueService] Error fetching all projects:', e);
      return Array.from(memoryProjectsStore.values());
    }
  }

  /**
   * Search local projects by name with 3-tier fuzzy & GPS matching (scoped by business)
   */
  public async searchLocalProjects(
    query: string,
    currentGPS?: { latitude?: number; longitude?: number }
  ): Promise<ProjectMatchResult> {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) {
      return {
        bestMatch: null,
        confidence: 0,
        matchReason: 'Empty query',
        isFuzzyConfirmationNeeded: false,
      };
    }

    const allProjects = await this.getAllProjects();
    return ProjectMatcher.matchProject(cleanQuery, allProjects, currentGPS);
  }

  /**
   * Create or cache a new project in local SQLite with optional GPS or address
   */
  public async createLocalProject(
    projectName: string,
    locationData?: { latitude?: number; longitude?: number; address?: string },
    synced = 0
  ): Promise<ProjectRecord> {
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const bizId = appConfigService.getBusinessId();
    const newProject: ProjectRecord = {
      id: projectId,
      name: projectName.trim(),
      business_id: bizId,
      status: 'IN_PROGRESS',
      created_at: new Date().toISOString(),
      synced,
      latitude: locationData?.latitude,
      longitude: locationData?.longitude,
      address: locationData?.address,
    };

    if (Platform.OS === 'web' || !db) {
      memoryProjectsStore.set(projectId, newProject);
      persistWebStorage();
      return newProject;
    }

    try {
      await db.runAsync(
        `INSERT INTO projects (id, name, business_id, status, created_at, synced, latitude, longitude, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          newProject.id,
          newProject.name,
          newProject.business_id || bizId,
          newProject.status || 'IN_PROGRESS',
          newProject.created_at,
          newProject.synced,
          newProject.latitude || null,
          newProject.longitude || null,
          newProject.address || null,
        ]
      );
      return newProject;
    } catch (error) {
      console.error('[SQLiteQueueService] Error creating project:', error);
      return newProject;
    }
  }

  public async getPendingProjects(): Promise<ProjectRecord[]> {
    if (Platform.OS === 'web' || !db) {
      return Array.from(memoryProjectsStore.values()).filter((p) => p.synced === 0);
    }

    try {
      return await db.getAllAsync<ProjectRecord>(
        `SELECT * FROM projects WHERE synced = 0 ORDER BY created_at ASC;`
      );
    } catch (error) {
      console.error('[SQLiteQueueService] Error fetching pending projects:', error);
      return [];
    }
  }

  public async markProjectSynced(id: string): Promise<void> {
    if (Platform.OS === 'web' || !db) {
      const existing = memoryProjectsStore.get(id);
      if (existing) {
        existing.synced = 1;
        memoryProjectsStore.set(id, existing);
        persistWebStorage();
      }
      return;
    }

    try {
      await db.runAsync(`UPDATE projects SET synced = 1 WHERE id = ?;`, [id]);
    } catch (error) {
      console.error('[SQLiteQueueService] Error marking project synced:', error);
    }
  }

  public async cacheRemoteProjects(remoteProjects: ProjectRecord[]): Promise<void> {
    const bizId = appConfigService.getBusinessId();
    for (const project of remoteProjects) {
      if (Platform.OS === 'web' || !db) {
        memoryProjectsStore.set(project.id, { ...project, business_id: bizId, synced: 1 });
      } else {
        try {
          await db.runAsync(
            `INSERT OR REPLACE INTO projects (id, name, business_id, created_at, synced, latitude, longitude, address)
             VALUES (?, ?, ?, ?, 1, ?, ?, ?);`,
            [
              project.id,
              project.name,
              project.business_id || bizId,
              project.created_at,
              project.latitude || null,
              project.longitude || null,
              project.address || null,
            ]
          );
        } catch {}
      }
    }
    if (Platform.OS === 'web') persistWebStorage();
  }

  public async enqueueNote(
    note: Omit<NoteQueueRecord, 'sync_status'> & { sync_status?: SyncStatus }
  ): Promise<NoteQueueRecord> {
    const bizId = appConfigService.getBusinessId();
    const userId = appConfigService.getUserId();
    const userName = appConfigService.getUserName();

    const record: NoteQueueRecord = {
      ...note,
      business_id: note.business_id || bizId,
      user_id: note.user_id || userId,
      user_name: note.user_name || userName,
      sync_status: note.sync_status || 'PENDING_SYNC',
    };

    if (Platform.OS === 'web' || !db) {
      memoryNotesStore.set(record.id, record);
      persistWebStorage();
      return record;
    }

    try {
      await db.runAsync(
        `INSERT INTO notes (
          id, timestamp, business_id, user_id, user_name, workflow_id, workflow_title, project_name, is_new_project, project_status, matched_project_id,
          latitude, longitude, location_address, location_type,
          raw_transcript, action_items, structured_data, audio_file_path, sync_status, firestore_doc_id, firebase_storage_url, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          record.id,
          record.timestamp,
          record.business_id || bizId,
          record.user_id || userId,
          record.user_name || userName,
          record.workflow_id || 'workflow_voice_note',
          record.workflow_title || 'Field Engineering Note',
          record.project_name,
          record.is_new_project ? 1 : 0,
          record.project_status,
          record.matched_project_id || null,
          record.latitude || null,
          record.longitude || null,
          record.location_address || null,
          record.location_type || null,
          record.raw_transcript,
          record.action_items,
          record.structured_data || null,
          record.audio_file_path,
          record.sync_status,
          record.firestore_doc_id || null,
          record.firebase_storage_url || null,
          record.error_message || null,
        ]
      );
      return record;
    } catch (error) {
      console.error('[SQLiteQueueService] Error enqueuing note:', error);
      throw error;
    }
  }

  public async getPendingNotes(): Promise<NoteQueueRecord[]> {
    if (Platform.OS === 'web' || !db) {
      return Array.from(memoryNotesStore.values()).filter(
        (n) => n.sync_status === 'PENDING_SYNC' || n.sync_status === 'SYNCING'
      );
    }

    try {
      const rows = await db.getAllAsync<any>(
        `SELECT * FROM notes WHERE sync_status IN ('PENDING_SYNC', 'SYNCING') ORDER BY timestamp ASC;`
      );
      return rows.map((r) => ({
        ...r,
        is_new_project: Boolean(r.is_new_project),
      }));
    } catch (error) {
      console.error('[SQLiteQueueService] Error fetching pending notes:', error);
      return [];
    }
  }

  public async getAllNotes(): Promise<NoteQueueRecord[]> {
    if (Platform.OS === 'web' || !db) {
      return Array.from(memoryNotesStore.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    try {
      const rows = await db.getAllAsync<any>(
        `SELECT * FROM notes ORDER BY timestamp DESC;`
      );
      return rows.map((r) => ({
        ...r,
        is_new_project: Boolean(r.is_new_project),
      }));
    } catch (error) {
      console.error('[SQLiteQueueService] Error fetching all notes:', error);
      return [];
    }
  }

  public async updateSyncStatus(
    id: string,
    sync_status: SyncStatus,
    firestore_doc_id?: string,
    firebase_storage_url?: string,
    error_message?: string
  ): Promise<void> {
    if (Platform.OS === 'web' || !db) {
      const existing = memoryNotesStore.get(id);
      if (existing) {
        existing.sync_status = sync_status;
        if (firestore_doc_id) existing.firestore_doc_id = firestore_doc_id;
        if (firebase_storage_url) existing.firebase_storage_url = firebase_storage_url;
        if (error_message) existing.error_message = error_message;
        memoryNotesStore.set(id, existing);
        persistWebStorage();
      }
      return;
    }

    try {
      await db.runAsync(
        `UPDATE notes 
         SET sync_status = ?, 
             firestore_doc_id = COALESCE(?, firestore_doc_id), 
             firebase_storage_url = COALESCE(?, firebase_storage_url),
             error_message = ?
         WHERE id = ?;`,
        [
          sync_status,
          firestore_doc_id || null,
          firebase_storage_url || null,
          error_message || null,
          id,
        ]
      );
    } catch (error) {
      console.error('[SQLiteQueueService] Error updating sync status:', error);
    }
  }

  public async deleteNote(id: string): Promise<void> {
    if (Platform.OS === 'web' || !db) {
      memoryNotesStore.delete(id);
      persistWebStorage();
      return;
    }

    try {
      await db.runAsync(`DELETE FROM notes WHERE id = ?;`, [id]);
    } catch (error) {
      console.error('[SQLiteQueueService] Error deleting note:', error);
    }
  }
}

export const sqliteQueueService = SQLiteQueueService.getInstance();
