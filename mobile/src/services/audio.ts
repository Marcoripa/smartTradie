import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { Platform } from 'react-native';

let currentRecording: Audio.Recording | null = null;

// Web Audio API context & recorder references
let webMediaStream: MediaStream | null = null;
let webMediaRecorder: MediaRecorder | null = null;
let webAudioContext: AudioContext | null = null;
let webAnalyser: AnalyserNode | null = null;
let webMeterInterval: any = null;
let webRecordedChunks: Blob[] = [];
let webRecordingUrl: string | null = null;

export async function requestAudioPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      } catch (err) {
        console.error('[Audio Web] Mic permission denied:', err);
        return false;
      }
    }
    return true;
  }

  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[Audio] Error requesting permissions:', error);
    return false;
  }
}

/**
 * Configure Audio Focus with ducking for Australian Road Rules compliance.
 */
export async function enableAudioDuckFocus(): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[Audio Web] Audio focus enabled (Web)');
    return;
  }

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

export async function releaseAudioFocus(): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[Audio Web] Audio focus released (Web)');
    return;
  }

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

/**
 * Start Audio Recording with real-time metering for both Native and Web platforms
 */
export async function startAudioRecording(
  onStatusUpdate?: (status: {
    canRecord: boolean;
    isRecording: boolean;
    durationMillis: number;
    metering?: number;
  }) => void
): Promise<any> {
  const hasPermission = await requestAudioPermissions();
  if (!hasPermission) {
    throw new Error('Microphone permission not granted');
  }

  await enableAudioDuckFocus();

  // --- WEB PLATFORM IMPLEMENTATION ---
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
    try {
      if (webMediaRecorder && webMediaRecorder.state !== 'inactive') {
        webMediaRecorder.stop();
      }
      if (webMeterInterval) {
        clearInterval(webMeterInterval);
        webMeterInterval = null;
      }

      webRecordedChunks = [];
      webMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Setup Web Audio API Analyser for live dB metering
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        webAudioContext = new AudioCtx();
        const source = webAudioContext.createMediaStreamSource(webMediaStream);
        webAnalyser = webAudioContext.createAnalyser();
        webAnalyser.fftSize = 512;
        source.connect(webAnalyser);
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      webMediaRecorder = new MediaRecorder(webMediaStream, { mimeType });

      webMediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          webRecordedChunks.push(event.data);
        }
      };

      webMediaRecorder.start(100);
      const startTime = Date.now();

      // Real-time audio metering loop on Web
      const dataArray = new Uint8Array(webAnalyser ? webAnalyser.frequencyBinCount : 0);
      webMeterInterval = setInterval(() => {
        let currentDb = -160;
        if (webAnalyser) {
          webAnalyser.getByteTimeDomainData(dataArray);
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          if (rms > 0.001) {
            // Convert RMS to dB: range approximately -60 dB to 0 dB
            currentDb = Math.max(-100, Math.min(0, 20 * Math.log10(rms)));
          }
        }

        if (onStatusUpdate) {
          onStatusUpdate({
            canRecord: true,
            isRecording: true,
            durationMillis: Date.now() - startTime,
            metering: currentDb,
          });
        }
      }, 100);

      console.log('[Audio Web] Web Audio recording & live metering started.');
      return webMediaRecorder;
    } catch (e) {
      console.error('[Audio Web] Failed to start web media recording:', e);
      return null;
    }
  }

  // --- NATIVE PLATFORM IMPLEMENTATION ---
  try {
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
      onStatusUpdate as any,
      100
    );

    currentRecording = recording;
    console.log('[Audio] Native recording started with 22.05kHz Mono AAC');
    return recording;
  } catch (error) {
    console.error('[Audio] Failed to start native recording:', error);
    return null;
  }
}

/**
 * Stop Audio Recording and return playable / persistable audio URI
 */
export async function stopAudioRecording(): Promise<string | null> {
  // --- WEB PLATFORM IMPLEMENTATION ---
  if (Platform.OS === 'web') {
    if (webMeterInterval) {
      clearInterval(webMeterInterval);
      webMeterInterval = null;
    }

    return new Promise((resolve) => {
      if (!webMediaRecorder || webMediaRecorder.state === 'inactive') {
        resolve(webRecordingUrl || `web://recording_${Date.now()}.webm`);
        return;
      }

      webMediaRecorder.onstop = () => {
        try {
          const blob = new Blob(webRecordedChunks, { type: 'audio/webm' });
          webRecordingUrl = URL.createObjectURL(blob);
          if (webMediaStream) {
            webMediaStream.getTracks().forEach((t) => t.stop());
            webMediaStream = null;
          }
          if (webAudioContext && webAudioContext.state !== 'closed') {
            webAudioContext.close();
            webAudioContext = null;
          }
          console.log('[Audio Web] Recording stopped. Blob URL:', webRecordingUrl);
          resolve(webRecordingUrl);
        } catch (e) {
          resolve(`web://recording_${Date.now()}.webm`);
        }
      };

      webMediaRecorder.stop();
    });
  }

  // --- NATIVE PLATFORM IMPLEMENTATION ---
  if (!currentRecording) return null;

  try {
    await currentRecording.stopAndUnloadAsync();
    const uri = currentRecording.getURI();
    currentRecording = null;
    console.log('[Audio] Native recording stopped. File saved at:', uri);
    return uri;
  } catch (error) {
    console.error('[Audio] Error stopping recording:', error);
    currentRecording = null;
    return null;
  }
}

export async function cancelAudioRecording(): Promise<void> {
  if (Platform.OS === 'web') {
    if (webMeterInterval) {
      clearInterval(webMeterInterval);
      webMeterInterval = null;
    }
    if (webMediaRecorder && webMediaRecorder.state !== 'inactive') {
      try {
        webMediaRecorder.stop();
      } catch {}
    }
    if (webMediaStream) {
      webMediaStream.getTracks().forEach((t) => t.stop());
      webMediaStream = null;
    }
    return;
  }

  if (!currentRecording) return;
  try {
    await currentRecording.stopAndUnloadAsync();
  } catch (e) {
    // Ignore error
  } finally {
    currentRecording = null;
  }
}
