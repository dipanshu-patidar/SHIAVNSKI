import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetellVoiceProvider } from '../../src/providers/retell.provider.js';

describe('RetellVoiceProvider Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws an error if instantiated with an empty API key', () => {
    expect(() => new RetellVoiceProvider('')).toThrow(
      'RetellVoiceProvider requires a valid RETELL_API_KEY'
    );
  });

  it('initializes successfully with a non-empty key and sets providerName to retell', () => {
    const provider = new RetellVoiceProvider('key_mock_test_123');
    expect(provider.providerName).toBe('retell');
    expect(provider.isMock).toBe(false);
  });

  it('correctly reports connectivity status and diagnostics', async () => {
    const provider = new RetellVoiceProvider('key_mock_test_123');

    // Mock client methods on the internal client
    const client = (provider as any).client;
    client.phoneNumber = {
      list: vi.fn().mockResolvedValue({
        items: [{ phone_number: '+14155551234' }],
      }),
    };
    client.agent = {
      list: vi.fn().mockResolvedValue({
        items: [{ agent_id: 'agent_1' }, { agent_id: 'agent_2' }],
      }),
    };
    client.voice = {
      list: vi.fn().mockResolvedValue([{ voice_id: 'voice_1' }]),
    };

    const result = await provider.checkConnectivity();
    expect(result.connected).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.agentCount).toBe(2);
    expect(result.voiceCount).toBe(1);
    expect(result.fromNumberStatus).toBe('verified_in_account');
    expect(result.registeredPhoneNumbers).toContain('+14155551234');
  });

  it('dispatches outbound phone call with override_agent_id and dynamic variables', async () => {
    const provider = new RetellVoiceProvider('key_mock_test_123');
    const client = (provider as any).client;

    client.call = {
      createPhoneCall: vi.fn().mockResolvedValue({
        call_id: 'call_retell_999',
        from_number: '+14155551234',
        to_number: '+14155552671',
        call_status: 'ongoing',
        agent_id: 'agent_retell_123',
        start_timestamp: 1700000000000,
      }),
    };

    const res = await provider.createPhoneCall({
      fromNumber: '+14155551234',
      toNumber: '+14155552671',
      providerAgentId: 'agent_retell_123',
      dynamicVariables: { customer_name: 'Alice' },
    });

    expect(client.call.createPhoneCall).toHaveBeenCalledWith(
      expect.objectContaining({
        from_number: '+14155551234',
        to_number: '+14155552671',
        override_agent_id: 'agent_retell_123',
        retell_llm_dynamic_variables: { customer_name: 'Alice' },
      })
    );

    expect(res.providerCallId).toBe('call_retell_999');
    expect(res.isMock).toBe(false);
    expect(res.status).toBe('ongoing');
  });
});
