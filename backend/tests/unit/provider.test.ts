import { describe, it, expect } from 'vitest';
import { getVoiceProvider, MockVoiceProvider } from '../../src/providers/index.js';

describe('Voice Provider Abstraction Unit Tests', () => {
  it('getVoiceProvider returns MockVoiceProvider in mock mode', () => {
    const provider = getVoiceProvider();
    expect(provider).toBeInstanceOf(MockVoiceProvider);
    expect(provider.providerName).toBe('mock');
    expect(provider.isMock).toBe(true);
  });

  it('MockVoiceProvider creates agent with agent_mock_ prefix and isMock true', async () => {
    const provider = new MockVoiceProvider();
    const result = await provider.createAgent({
      name: 'Mock Test Agent',
      voiceId: '11labs-Adrian',
      language: 'en-US',
      systemPrompt: 'You are a test mock agent',
    });

    expect(result.providerAgentId).toMatch(/^agent_mock_/);
    expect(result.isMock).toBe(true);
    expect(result.name).toBe('Mock Test Agent');
  });

  it('MockVoiceProvider retrieves and updates agent details', async () => {
    const provider = new MockVoiceProvider();
    const created = await provider.createAgent({
      name: 'Initial Name',
      voiceId: '11labs-Adrian',
      systemPrompt: 'Initial prompt',
    });

    const updated = await provider.updateAgent(created.providerAgentId, {
      name: 'Updated Name',
      responsiveness: 1.3,
    });

    expect(updated.name).toBe('Updated Name');

    const details = await provider.getAgent(created.providerAgentId);
    expect(details.name).toBe('Updated Name');
    expect(details.responsiveness).toBe(1.3);
  });

  it('MockVoiceProvider dispatches outbound call with call_mock_ prefix', async () => {
    const provider = new MockVoiceProvider();
    const result = await provider.createPhoneCall({
      fromNumber: '+14155551234',
      toNumber: '+14155552671',
      providerAgentId: 'agent_mock_test123',
      dynamicVariables: { user: 'Test' },
    });

    expect(result.providerCallId).toMatch(/^call_mock_/);
    expect(result.isMock).toBe(true);
    expect(result.status).toBe('initiated');

    const details = await provider.getCallDetails(result.providerCallId);
    expect(details.providerCallId).toBe(result.providerCallId);
    expect(details.isMock).toBe(true);
  });
});
