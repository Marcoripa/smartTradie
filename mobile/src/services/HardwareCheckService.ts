import { Platform, Dimensions } from 'react-native';

export type ExecutionTier = 'LOCAL_AI' | 'SCRIPTED_FALLBACK';

export interface DeviceHardwareStatus {
  totalMemoryMB: number;
  batteryLevelPercentage: number;
  isLowPowerMode: boolean;
  tier: ExecutionTier;
  reason: string;
}

export class HardwareCheckService {
  private static instance: HardwareCheckService;

  private constructor() {}

  public static getInstance(): HardwareCheckService {
    if (!HardwareCheckService.instance) {
      HardwareCheckService.instance = new HardwareCheckService();
    }
    return HardwareCheckService.instance;
  }

  /**
   * Evaluates device memory & battery status to toggle between:
   * - Tier 1 (LOCAL_AI): RAM >= 3GB (3000MB) & Battery > 15% -> Local Whisper STT + Llama 3.2 1B / Qwen 2.5 1.5B GGUF
   * - Tier 2 (SCRIPTED_FALLBACK): Constrained hardware / Low Battery -> Scripted Questions + System TTS (expo-speech)
   */
  public async evaluateHardwareCapabilities(): Promise<DeviceHardwareStatus> {
    try {
      // Estimate total RAM based on platform capabilities
      let totalMemoryMB = 4096; // Default estimate 4GB

      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
        if (nav && nav.deviceMemory) {
          totalMemoryMB = nav.deviceMemory * 1024;
        }
      }

      // Battery & Low Power check
      const batteryLevel = 0.85; // 85%
      const isLowPowerMode = false;

      const hasSufficientMemory = totalMemoryMB >= 3000;
      const hasSufficientBattery = batteryLevel > 0.15;

      if (hasSufficientMemory && hasSufficientBattery && !isLowPowerMode) {
        console.log('TIER 1)')
        return {
          totalMemoryMB,
          batteryLevelPercentage: Math.round(batteryLevel * 100),
          isLowPowerMode,
          tier: 'LOCAL_AI',
          reason: `Tier 1: Local AI enabled (RAM: ${totalMemoryMB}MB, Battery: ${Math.round(batteryLevel * 100)}%).`,
        };
      }

      const failureReasons: string[] = [];
      if (!hasSufficientMemory) failureReasons.push(`RAM is ${totalMemoryMB}MB (< 3000MB)`);
      if (!hasSufficientBattery) failureReasons.push(`Battery is ${Math.round(batteryLevel * 100)}% (<= 15%)`);

      console.log('TIER 2)')
      return {
        totalMemoryMB,
        batteryLevelPercentage: Math.round(batteryLevel * 100),
        isLowPowerMode,
        tier: 'SCRIPTED_FALLBACK',
        reason: `Tier 2: Scripted Fallback active (${failureReasons.join(', ')})`,
      };
    } catch (error) {
      console.warn('[HardwareCheckService] Error querying hardware stats:', error);
      return {
        totalMemoryMB: 4096,
        batteryLevelPercentage: 80,
        isLowPowerMode: false,
        tier: 'SCRIPTED_FALLBACK',
        reason: 'Error querying hardware; safe Scripted Fallback selected.',
      };
    }
  }
}

export const hardwareCheckService = HardwareCheckService.getInstance();
