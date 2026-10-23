import { config } from '../config/index.js';
import { IVoiceProvider } from './voice-provider.interface.js';
import { MockVoiceProvider } from './mock.provider.js';
import { RetellVoiceProvider } from './retell.provider.js';

export * from './voice-provider.interface.js';
export * from './mock.provider.js';
export * from './retell.provider.js';

let cachedProvider: IVoiceProvider | null = null;

export function getVoiceProvider(): IVoiceProvider {
  if (!cachedProvider) {
    if (config.PROVIDER_MODE === 'retell') {
      cachedProvider = new RetellVoiceProvider();
    } else {
      // Default: Mock simulation provider (zero credentials required)
      cachedProvider = new MockVoiceProvider();
    }
  }
  return cachedProvider;
}

/**
 * Reset or override the cached voice provider (useful for unit testing).
 */
export function setCachedVoiceProvider(provider: IVoiceProvider | null) {
  cachedProvider = provider;
}
