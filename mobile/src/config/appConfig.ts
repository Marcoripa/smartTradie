import { Platform } from 'react-native';

export interface AppConfig {
  user_id: string;
  user_name: string;
  business_id: string;
  business_name: string;
}

// Default device configuration (can be packaged with the app APK/bundle or loaded on first boot)
export const DEFAULT_APP_CONFIG: AppConfig = {
  user_id: 'usr_tradie_088',
  user_name: 'Dave',
  business_id: 'biz_apex_mining',
  business_name: 'Apex Mining & Electrical Services',
};

class AppConfigService {
  private static instance: AppConfigService;
  private config: AppConfig = DEFAULT_APP_CONFIG;

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
          this.config = { ...DEFAULT_APP_CONFIG, ...JSON.parse(saved) };
        }
      } catch {}
    }
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
