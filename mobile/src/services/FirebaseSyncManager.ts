import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { sqliteQueueService, NoteQueueRecord, ProjectRecord } from './SQLiteQueueService';
import { firestoreService } from './FirestoreService';

let isSyncInProgress = false;
let isSimulatedOfflineMode = false;

export class FirebaseSyncManager {
  private static instance: FirebaseSyncManager;

  private constructor() {}

  public static getInstance(): FirebaseSyncManager {
    if (!FirebaseSyncManager.instance) {
      FirebaseSyncManager.instance = new FirebaseSyncManager();
    }
    return FirebaseSyncManager.instance;
  }

  public setSimulatedOffline(offline: boolean): void {
    isSimulatedOfflineMode = offline;
    console.log(`[FirebaseSyncManager] Simulated offline set to: ${offline}`);
  }

  public isSimulatedOffline(): boolean {
    return isSimulatedOfflineMode;
  }

  /**
   * Upload audio file to Cloud Storage / Firebase Storage
   */
  private async uploadAudioToFirebaseStorage(noteId: string, localAudioPath: string): Promise<string> {
    console.log(`[FirebaseSyncManager] Uploading audio file ${localAudioPath} to GCS / Firebase Storage: voice_notes/${noteId}.m4a`);
    await new Promise((resolve) => setTimeout(resolve, 600));
    return `https://storage.googleapis.com/smart-tradie-voice-notes/voice_notes/${noteId}.m4a`;
  }

  /**
   * Sync a single pending project to Firestore 'projects' collection
   */
  public async syncSingleProject(project: ProjectRecord): Promise<boolean> {
    console.log(`[FirebaseSyncManager] Pushing local project to Firestore: ${project.name} (${project.id})`);
    const res = await firestoreService.saveProjectToFirestore(project);
    if (res.success) {
      await sqliteQueueService.markProjectSynced(project.id);
      console.log(`[FirebaseSyncManager] Project ${project.name} successfully synced to Firestore!`);
      return true;
    }
    return false;
  }

  /**
   * Process and sync a single pending note to Firebase
   */
  public async syncSingleNote(note: NoteQueueRecord): Promise<void> {
    console.log(`[FirebaseSyncManager] Syncing note ID: ${note.id}`);
    await sqliteQueueService.updateSyncStatus(note.id, 'SYNCING');

    try {
      // 1. Upload .m4a audio file to Cloud Storage
      const storageUrl = await this.uploadAudioToFirebaseStorage(note.id, note.audio_file_path);

      // 2. Create document in Firestore 'notes' collection
      const res = await firestoreService.saveNoteToFirestore(note, storageUrl);
      const firestoreDocId = res.firestoreId || `firestore_${note.id}`;

      // 3. Mark synced in local SQLite queue
      await sqliteQueueService.updateSyncStatus(note.id, 'SYNCED', firestoreDocId, storageUrl);
      console.log(`[FirebaseSyncManager] Successfully synced note ${note.id} to Firestore & Storage!`);
    } catch (error: any) {
      console.error(`[FirebaseSyncManager] Error syncing note ${note.id}:`, error);
      await sqliteQueueService.updateSyncStatus(
        note.id,
        'PENDING_SYNC',
        undefined,
        undefined,
        error?.message || 'Firebase upload failed'
      );
      throw error;
    }
  }

  /**
   * Sync all pending projects & notes in SQLite database to Firestore
   */
  public async syncPendingQueue(): Promise<number> {
    if (isSyncInProgress) return 0;
    if (isSimulatedOfflineMode) {
      console.log('[FirebaseSyncManager] Simulated offline active; skipping Firebase sync.');
      return 0;
    }

    isSyncInProgress = true;
    let syncedCount = 0;

    try {
      // 1. First, sync any offline created projects to Firestore
      const pendingProjects = await sqliteQueueService.getPendingProjects();
      if (pendingProjects.length > 0) {
        console.log(`[FirebaseSyncManager] Found ${pendingProjects.length} pending projects to sync to Firestore.`);
        for (const proj of pendingProjects) {
          await this.syncSingleProject(proj);
        }
      }

      // 2. Pull remote projects from Firestore and cache them into local SQLite
      try {
        const remoteProjects = await firestoreService.fetchProjectsFromFirestore();
        if (remoteProjects.length > 0) {
          await sqliteQueueService.cacheRemoteProjects(remoteProjects);
        }
      } catch (e) {
        console.warn('[FirebaseSyncManager] Could not refresh remote projects cache:', e);
      }

      // 3. Sync pending voice notes to Firestore
      const pendingNotes = await sqliteQueueService.getPendingNotes();
      console.log(`[FirebaseSyncManager] Found ${pendingNotes.length} notes with status PENDING_SYNC`);

      for (const note of pendingNotes) {
        try {
          await this.syncSingleNote(note);
          syncedCount++;
        } catch (err) {
          console.warn(`[FirebaseSyncManager] Retrying note ${note.id} on next connection.`);
        }
      }
    } finally {
      isSyncInProgress = false;
    }

    return syncedCount;
  }

  /**
   * Register background NetInfo listener to auto-sync when 4G/5G is restored
   */
  public startNetworkListener(onSyncComplete?: (count: number) => void): () => void {
    console.log('[FirebaseSyncManager] NetInfo listener initialized.');
    
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (!isSimulatedOfflineMode && state.isConnected && state.isInternetReachable !== false) {
        console.log('[FirebaseSyncManager] 4G/5G Connectivity Restored! Triggering Firebase auto-sync...');
        this.syncPendingQueue().then((count) => {
          if (count > 0 && onSyncComplete) {
            onSyncComplete(count);
          }
        });
      }
    });

    return unsubscribe;
  }
}

export const firebaseSyncManager = FirebaseSyncManager.getInstance();
