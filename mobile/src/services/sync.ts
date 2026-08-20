import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { getPendingNotesQueue, updateNoteStatus } from './sqlite';
import { LocalNoteRecord } from '../types';
import { Platform } from 'react-native';
import { appConfigService } from '../config/appConfig';

let BACKEND_URL = 'http://localhost:8000'; // Default backend server
let isSyncing = false;
let simulatedOffline = false;

export function setBackendUrl(url: string) {
  BACKEND_URL = url.replace(/\/$/, '');
}

export function getBackendUrl(): string {
  return BACKEND_URL;
}

export function setSimulatedOffline(offline: boolean) {
  simulatedOffline = offline;
  console.log(`[Sync] Simulated offline state changed to: ${offline}`);
}

export function isSimulatedOffline(): boolean {
  return simulatedOffline;
}

export async function checkNetworkStatus(): Promise<boolean> {
  if (simulatedOffline) return false;
  try {
    const state = await NetInfo.fetch();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch (e) {
    return true; // Assume online if NetInfo fails in web preview
  }
}

/**
 * Robust helper to upload audio file across Web, iOS, and Android
 */
async function uploadAudioFile(fileUri: string, fieldName: string): Promise<string> {
  if (!fileUri || fileUri.startsWith('mock://')) {
    return `mock_${fieldName}_path.m4a`;
  }

  const formData = new FormData();
  const filename = fileUri.split('/').pop() || `${fieldName}.m4a`;

  if (Platform.OS === 'web' || fileUri.startsWith('blob:') || fileUri.startsWith('data:')) {
    try {
      // In web browser, fetch the blob URI first
      const blobRes = await fetch(fileUri);
      const blob = await blobRes.blob();
      formData.append('file', blob, filename);
    } catch (e) {
      console.warn('[Sync] Could not fetch web audio blob, falling back to mock identifier:', e);
      return `web_${fieldName}_fallback.m4a`;
    }
  } else {
    // Native React Native (iOS / Android)
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: 'audio/m4a',
    } as any);
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/upload/direct`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Upload server error ${response.status}: ${errText || response.statusText}`);
    }

    const data = await response.json();
    return data.file_path || data.file_key;
  } catch (error: any) {
    if (error?.message?.includes('Network request failed') || error instanceof TypeError) {
      throw new Error(
        `Unable to reach backend at ${BACKEND_URL}. Ensure FastAPI is running and backend URL is correct (use 10.0.2.2:8000 for Android emulator, or your local Wi-Fi IP for physical devices).`
      );
    }
    throw error;
  }
}

export async function processNoteUpload(note: LocalNoteRecord): Promise<void> {
  console.log(`[Sync] Starting upload process for note ID: ${note.id}`);
  await updateNoteStatus(note.id, 'UPLOADING');

  try {
    // 1. Upload the audio recordings
    const clientAudioPath = await uploadAudioFile(note.client_audio_uri, 'prompt_1_client');
    const contentAudioPath = await uploadAudioFile(note.content_audio_uri, 'prompt_2_content');
    const actionsAudioPath = await uploadAudioFile(note.actions_audio_uri, 'prompt_3_actions');

    // 2. Trigger transcription & Gemini AI structuring on backend
    const processResponse = await fetch(`${BACKEND_URL}/api/v1/notes/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        local_id: note.id,
        business_id: appConfigService.getBusinessId(),
        user_id: appConfigService.getUserId(),
        user_name: appConfigService.getUserName(),
        created_at: new Date(note.created_at).toISOString(),
        client_audio_path: clientAudioPath,
        content_audio_path: contentAudioPath,
        actions_audio_path: actionsAudioPath,
      }),
    });

    if (!processResponse.ok) {
      const errBody = await processResponse.text().catch(() => '');
      throw new Error(`Backend note processing failed (${processResponse.status}): ${errBody}`);
    }

    const result = await processResponse.json();
    console.log(`[Sync] Note ${note.id} processed successfully by backend!`, result);

    // 3. Mark completed in SQLite
    await updateNoteStatus(
      note.id,
      'UPLOADED',
      result.id,
      JSON.stringify(result)
    );
  } catch (error: any) {
    console.error(`[Sync] Error uploading note ${note.id}:`, error);
    await updateNoteStatus(
      note.id,
      'FAILED',
      undefined,
      undefined,
      error?.message || 'Network or backend error'
    );
    throw error;
  }
}

export async function syncPendingQueue(): Promise<number> {
  if (isSyncing) return 0;
  
  const isOnline = await checkNetworkStatus();
  if (!isOnline) {
    console.log('[Sync] Device is offline or simulated offline. Skipping sync.');
    return 0;
  }

  isSyncing = true;
  let syncedCount = 0;

  try {
    const queue = await getPendingNotesQueue();
    console.log(`[Sync] Found ${queue.length} pending notes to sync`);

    for (const note of queue) {
      try {
        await processNoteUpload(note);
        syncedCount++;
      } catch (err) {
        console.warn(`[Sync] Failed sync attempt for ${note.id}, will retry on next connection.`);
      }
    }
  } finally {
    isSyncing = false;
  }

  return syncedCount;
}

/**
 * Initializes automatic background sync listener
 */
export function setupNetworkSyncListener(onSyncCompleted?: (count: number) => void): () => void {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    if (!simulatedOffline && state.isConnected && state.isInternetReachable !== false) {
      console.log('[Sync] Internet reconnected! Triggering auto-sync...');
      syncPendingQueue().then((count) => {
        if (count > 0 && onSyncCompleted) {
          onSyncCompleted(count);
        }
      });
    }
  });

  return unsubscribe;
}
