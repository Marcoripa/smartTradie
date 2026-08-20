import { Platform } from 'react-native';
import bundledConfig from './appConfig.json';

export interface AppConfig {
  user_id: string;
  user_name: string;
  business_id: string;
  business_name: string;
}

// Device configuration (loaded directly from appConfig.json or persisted storage)
export const DEFAULT_APP_CONFIG: AppConfig = {
  user_id: bundledConfig.user_id || '',
  user_name: bundledConfig.user_name || '',
  business_id: bundledConfig.business_id || '',
  business_name: bundledConfig.business_name || '',
};

class AppConfigService {
  private static instance: AppConfigService;
  private config: AppConfig = { ...DEFAULT_APP_CONFIG };

  private constructor() {
    this.loadPersistedConfig();
  }

  public static getInstance(): AppConfigService {
    if (!AppConfigService.instance) {
      AppConfigService.instance = new AppConfigService();
    }
    return AppConfigService.instance;
  }

  private loadPersistedConfig(): void {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('smart_tradie_app_config');
        if (saved) {
          const parsed = JSON.parse(saved);
          // Prefer non-empty bundledConfig if saved was blank
          this.config = {
            user_id: parsed.user_id || DEFAULT_APP_CONFIG.user_id,
            user_name: parsed.user_name || DEFAULT_APP_CONFIG.user_name,
            business_id: parsed.business_id || DEFAULT_APP_CONFIG.business_id,
            business_name: parsed.business_name || DEFAULT_APP_CONFIG.business_name,
          };
          return;
        }
      } catch {}
    }
    this.config = { ...DEFAULT_APP_CONFIG };
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public getUserName(): string {
    return this.config.user_name || 'Tradie';
  }

  public getUserId(): string {
    return this.config.user_id;
  }

  public getBusinessId(): string {
    return this.config.business_id;
  }

  public getBusinessName(): string {
    return this.config.business_name;
  }

  public updateConfig(partial: Partial<AppConfig>): void {
    this.config = { ...this.config, ...partial };
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('smart_tradie_app_config', JSON.stringify(this.config));
      } catch {}
    }
    console.log('[AppConfigService] Updated config:', this.config);
  }
}

export const appConfigService = AppConfigService.getInstance();
