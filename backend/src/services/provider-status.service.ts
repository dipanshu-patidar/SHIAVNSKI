import { config, getSafeProviderConfig, getRetellWebhookKey } from '../config/index.js';
import { RetellVoiceProvider, RetellConnectivityCheckResult } from '../providers/retell.provider.js';

export interface ProviderDiagnosticReport {
  mode: 'mock' | 'retell';
  isLiveModeEnabled: boolean;
  configuration: {
    hasApiKey: boolean;
    hasWebhookKey: boolean;
    hasCallerNumber: boolean;
    configuredFromNumber: string | null;
  };
  connectivity?: RetellConnectivityCheckResult;
  readiness: {
    apiAuthentication: boolean;
    callerNumberVerified: boolean;
    webhookEndpointReady: boolean;
    readyForLiveCalls: boolean;
  };
  missingRequirements: string[];
  recommendations: string[];
}

export class ProviderStatusService {
  /**
   * Safe status check without making network requests.
   */
  getStatus() {
    return getSafeProviderConfig();
  }

  /**
   * Execute safe, read-only connectivity check with Retell AI.
   * Does NOT place calls, does NOT purchase numbers, and NEVER leaks the API key.
   */
  async runConnectivityCheck(overrideApiKey?: string): Promise<ProviderDiagnosticReport> {
    const key = overrideApiKey || config.RETELL_API_KEY;
    const hasKey = Boolean(key && key.trim() !== '');
    const hasWebhookKey = Boolean(getRetellWebhookKey() && getRetellWebhookKey().trim() !== '');
    const configuredFromNumber = config.RETELL_FROM_NUMBER || null;

    const missing: string[] = [];
    const recommendations: string[] = [];

    if (!hasKey) {
      missing.push('RETELL_API_KEY is missing in backend/.env');
      recommendations.push(
        'Add your Retell API key (with Webhook badge enabled) to backend/.env as RETELL_API_KEY="key_..."'
      );
    }

    if (!configuredFromNumber) {
      missing.push('RETELL_FROM_NUMBER is not set in backend/.env');
      recommendations.push(
        'Configure a purchased or imported Retell phone number in E.164 format (e.g. +14155551234)'
      );
    }

    let connectivityResult: RetellConnectivityCheckResult | undefined;
    let apiAuthSuccess = false;
    let callerNumberVerified = false;

    if (hasKey) {
      try {
        const provider = new RetellVoiceProvider(key);
        connectivityResult = await provider.checkConnectivity();
        apiAuthSuccess = connectivityResult.connected;

        if (connectivityResult.fromNumberStatus === 'verified_in_account') {
          callerNumberVerified = true;
        } else if (connectivityResult.fromNumberStatus === 'not_in_account') {
          missing.push(
            `Configured number (${configuredFromNumber}) is NOT registered in this Retell account`
          );
          if (connectivityResult.registeredPhoneNumbers.length > 0) {
            recommendations.push(
              `Available numbers in your Retell account: ${connectivityResult.registeredPhoneNumbers.join(
                ', '
              )}. Update RETELL_FROM_NUMBER in backend/.env to match one of these.`
            );
          } else {
            recommendations.push(
              'No phone numbers found in your Retell account. Purchase or import a phone number in your Retell AI dashboard.'
            );
          }
        } else if (connectivityResult.fromNumberStatus === 'no_numbers_in_account') {
          missing.push('No phone numbers exist in your Retell AI account');
          recommendations.push(
            'Purchase a phone number or import your Twilio/SIP number in the Retell AI dashboard.'
          );
        }

        if (connectivityResult.agentCount === 0) {
          recommendations.push(
            'No Retell AI agents found in your Retell account. You can create an agent via the Agent Management dashboard.'
          );
        }
      } catch (err: any) {
        apiAuthSuccess = false;
        missing.push(`Retell authentication error: ${err.message || 'Unable to connect'}`);
      }
    }

    // Webhook instructions
    recommendations.push(
      'Configure your Retell Webhook URL in your Retell AI dashboard -> Settings -> Webhook to: https://<your-public-url>/api/webhooks/retell'
    );

    const readyForLiveCalls = apiAuthSuccess && callerNumberVerified;

    return {
      mode: config.PROVIDER_MODE,
      isLiveModeEnabled: config.PROVIDER_MODE === 'retell',
      configuration: {
        hasApiKey: hasKey,
        hasWebhookKey,
        hasCallerNumber: Boolean(configuredFromNumber),
        configuredFromNumber,
      },
      connectivity: connectivityResult,
      readiness: {
        apiAuthentication: apiAuthSuccess,
        callerNumberVerified,
        webhookEndpointReady: true,
        readyForLiveCalls,
      },
      missingRequirements: missing,
      recommendations,
    };
  }
}

export const providerStatusService = new ProviderStatusService();
