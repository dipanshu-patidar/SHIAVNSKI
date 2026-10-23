import { describe, it, expect } from 'vitest';
import { config } from '../../src/config/index.js';

describe('Configuration & Environment Validation', () => {
  it('loads valid configuration object with defaults', () => {
    expect(config).toBeDefined();
    expect(typeof config.PORT).toBe('number');
    expect(['development', 'production', 'test']).toContain(config.NODE_ENV);
    expect(config.DATABASE_URL).toBeDefined();
    expect(config.JWT_SECRET.length).toBeGreaterThanOrEqual(16);
    expect(['mock', 'retell']).toContain(config.PROVIDER_MODE);
  });
});
