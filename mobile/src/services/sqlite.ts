import * as SQLite from 'expo-sqlite';
import { LocalNoteRecord, NoteStatus } from '../types';
import { Platform } from 'react-native';

const DB_NAME = 'smart_tradie_voice_notes.db';

let db: SQLite.SQLiteDatabase | null = null;
const memoryStore: Map<string, LocalNoteRecord> = new Map();

export async function initDatabase(): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[SQLite] Running in Web mode; using memory store fallback');
    return;
  }

  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        created_at INTEGER NOT NULL,
        client_audio_uri TEXT NOT NULL,
        content_audio_uri TEXT NOT NULL,
        actions_audio_uri TEXT NOT NULL,
        status TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        error_message TEXT,
        backend_note_id TEXT,
        structured_data_json TEXT
      );
    `);
    console.log('[SQLite] Database initialized successfully');
  } catch (error) {
    console.error('[SQLite] Failed to initialize database:', error);
  }
}

export async function insertNoteRecord(note: LocalNoteRecord): Promise<void> {
  if (Platform.OS === 'web' || !db) {
    memoryStore.set(note.id, note);
    return;
  }

  try {
    await db.runAsync(
      `INSERT INTO notes (id, created_at, client_audio_uri, content_audio_uri, actions_audio_uri, status, retry_count, error_message, backend_note_id, structured_data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        note.id,
        note.created_at,
        note.client_audio_uri,
        note.content_audio_uri,
        note.actions_audio_uri,
        note.status,
        note.retry_count || 0,
        note.error_message || null,
        note.backend_note_id || null,
        note.structured_data_json || null
      ]
    );
  } catch (error) {
    console.error('[SQLite] Error inserting note:', error);
    throw error;
  }
}

export async function getPendingNotesQueue(): Promise<LocalNoteRecord[]> {
  if (Platform.OS === 'web' || !db) {
    return Array.from(memoryStore.values()).filter(
      (n) => n.status === 'PENDING_UPLOAD' || n.status === 'FAILED'
    );
  }

  try {
    const rows = await db.getAllAsync<LocalNoteRecord>(
      `SELECT * FROM notes WHERE status IN ('PENDING_UPLOAD', 'FAILED', 'UPLOADING') ORDER BY created_at ASC;`
    );
    return rows;
  } catch (error) {
    console.error('[SQLite] Error getting pending notes:', error);
    return [];
  }
}

export async function getAllNotesRecords(): Promise<LocalNoteRecord[]> {
  if (Platform.OS === 'web' || !db) {
    return Array.from(memoryStore.values()).sort((a, b) => b.created_at - a.created_at);
  }

  try {
    const rows = await db.getAllAsync<LocalNoteRecord>(
      `SELECT * FROM notes ORDER BY created_at DESC;`
    );
    return rows;
  } catch (error) {
    console.error('[SQLite] Error getting all notes:', error);
    return [];
  }
}

export async function updateNoteStatus(
  id: string,
  status: NoteStatus,
  backendNoteId?: string,
  structuredDataJson?: string,
  errorMessage?: string
): Promise<void> {
  if (Platform.OS === 'web' || !db) {
    const existing = memoryStore.get(id);
    if (existing) {
      existing.status = status;
      if (backendNoteId) existing.backend_note_id = backendNoteId;
      if (structuredDataJson) existing.structured_data_json = structuredDataJson;
      if (errorMessage) existing.error_message = errorMessage;
      if (status === 'FAILED') existing.retry_count += 1;
      memoryStore.set(id, existing);
    }
    return;
  }

  try {
    if (status === 'FAILED') {
      await db.runAsync(
        `UPDATE notes SET status = ?, retry_count = retry_count + 1, error_message = ? WHERE id = ?;`,
        [status, errorMessage || 'Upload failed', id]
      );
    } else {
      await db.runAsync(
        `UPDATE notes SET status = ?, backend_note_id = COALESCE(?, backend_note_id), structured_data_json = COALESCE(?, structured_data_json), error_message = NULL WHERE id = ?;`,
        [status, backendNoteId || null, structuredDataJson || null, id]
      );
    }
  } catch (error) {
    console.error('[SQLite] Error updating note status:', error);
  }
}

export async function deleteNoteRecord(id: string): Promise<void> {
  if (Platform.OS === 'web' || !db) {
    memoryStore.delete(id);
    return;
  }

  try {
    await db.runAsync(`DELETE FROM notes WHERE id = ?;`, [id]);
  } catch (error) {
    console.error('[SQLite] Error deleting note record:', error);
  }
}
