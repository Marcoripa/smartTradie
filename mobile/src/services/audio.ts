import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { Platform } from 'react-native';

let currentRecording: Audio.Recording | null = null;

export async function requestAudioPermissions(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[Audio] Error requesting permissions:', error);
    return false;
  }
}

/**
 * Configure native Audio Focus with ducking enabled for Australian Road Rules compliance.
 * Background car audio/music volume will drop (duck) when speaking or recording.
 */
export async function enableAudioDuckFocus(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    });
    console.log('[Audio] Audio focus set to DUCK_OTHERS');
  } catch (error) {
    console.warn('[Audio] Failed to set audio ducking mode:', error);
  }
}

/**
 * Release Audio Focus so background radio / Bluetooth media resumes full volume.
 */
export async function releaseAudioFocus(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      shouldDuckAndroid: false,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    });
    console.log('[Audio] Released audio focus (music resumes full volume)');
  } catch (error) {
    console.warn('[Audio] Failed to release audio focus:', error);
  }
}

export const MONO_AAC_LOW_BITRATE: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 22050,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 22050,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

export async function startAudioRecording(
  onStatusUpdate?: (status: Audio.RecordingStatus) => void
): Promise<Audio.Recording | null> {
  try {
    // Ensure permissions and audio mode setup
    const hasPermission = await requestAudioPermissions();
    if (!hasPermission) {
      throw new Error('Microphone permission not granted');
    }

    await enableAudioDuckFocus();

    if (currentRecording) {
      try {
        await currentRecording.stopAndUnloadAsync();
      } catch (e) {
        // Ignore unloads
      }
      currentRecording = null;
    }

    const { recording } = await Audio.Recording.createAsync(
      MONO_AAC_LOW_BITRATE,
      onStatusUpdate,
      100 // Metering update interval ms
    );

    currentRecording = recording;
    console.log('[Audio] Recording started with 22.05kHz Mono AAC settings');
    return recording;
  } catch (error) {
    console.error('[Audio] Failed to start recording:', error);
    return null;
  }
}

export async function stopAudioRecording(): Promise<string | null> {
  if (!currentRecording) return null;

  try {
    await currentRecording.stopAndUnloadAsync();
    const uri = currentRecording.getURI();
    currentRecording = null;
    console.log('[Audio] Recording stopped. File saved at:', uri);
    return uri;
  } catch (error) {
    console.error('[Audio] Error stopping recording:', error);
    currentRecording = null;
    return null;
  }
}

export async function cancelAudioRecording(): Promise<void> {
  if (!currentRecording) return;
  try {
    await currentRecording.stopAndUnloadAsync();
  } catch (e) {
    // Ignore error
  } finally {
    currentRecording = null;
  }
}
