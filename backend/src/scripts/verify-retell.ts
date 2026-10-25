import { providerStatusService } from '../services/provider-status.service.js';

async function main() {
  console.log('===============================================================');
  console.log(' Retell AI Provider Configuration & Connectivity Inspector');
  console.log('===============================================================\n');

  try {
    const report = await providerStatusService.runConnectivityCheck();

    console.log(`Current Provider Mode: [${report.mode.toUpperCase()}]`);
    console.log(`Live Cloud Dispatch Active: ${report.isLiveModeEnabled ? 'YES' : 'NO (Mock mode is safe and active)'}`);
    console.log(`API Key Configured: ${report.configuration.hasApiKey ? 'YES (Key hidden for security)' : 'NO'}`);
    console.log(`Webhook Key Configured: ${report.configuration.hasWebhookKey ? 'YES' : 'NO (Falls back to API key)'}`);
    console.log(`Configured Caller ID: ${report.configuration.configuredFromNumber || 'None'}`);
    console.log(`Configured Agent ID: ${report.configuration.configuredAgentId || 'None'}\n`);

    if (report.connectivity) {
      console.log('--- Retell API Connectivity Check Result ---');
      console.log(`Authenticated: ${report.connectivity.connected ? 'SUCCESS' : 'FAILED'}`);
      console.log(`HTTP Status: ${report.connectivity.statusCode || 'N/A'}`);
      console.log(`Message: ${report.connectivity.message}`);
      console.log(`Caller Number Status: ${report.connectivity.fromNumberStatus.toUpperCase()}`);
      console.log(`Phone Numbers in Retell Account: ${report.connectivity.registeredPhoneNumbers.length}`);
      if (report.connectivity.registeredPhoneNumbers.length > 0) {
        report.connectivity.registeredPhoneNumbers.forEach((num) => console.log(`  - ${num}`));
      }
      console.log(`Agents in Retell Account: ${report.connectivity.agentCount}`);
      console.log(`Voices in Retell Account: ${report.connectivity.voiceCount}`);

      if (report.connectivity.retellAgentVerified && report.connectivity.retellAgentDetails) {
        const ag = report.connectivity.retellAgentDetails;
        console.log(`\n--- Configured Retell Agent Verification ---`);
        console.log(`Agent ID: ${ag.agentId}`);
        console.log(`Agent Name: ${ag.name}`);
        console.log(`Voice Model: ${ag.voiceId}`);
        console.log(`Language: ${ag.language}`);
        console.log(`Interruption Sensitivity: ${ag.interruptionSensitivity ?? 0.8}`);
        console.log(`Verified in Retell API: YES`);
      }
      console.log('');
    }

    console.log('--- Readiness Status ---');
    console.log(`API Authentication: ${report.readiness.apiAuthentication ? 'READY' : 'PENDING'}`);
    console.log(`Agent Configured & Verified: ${report.readiness.agentConfigured ? 'READY' : 'PENDING'}`);
    console.log(`Caller Number Verified: ${report.readiness.callerNumberVerified ? 'READY' : 'PENDING'}`);
    console.log(`Webhook Endpoint: ${report.readiness.webhookEndpointReady ? 'READY (/api/webhooks/retell)' : 'NOT READY'}`);
    console.log(`Ready for Live Calls: ${report.readiness.readyForLiveCalls ? 'YES' : 'NO (Missing prerequisite items)'}\n`);

    if (report.missingRequirements.length > 0) {
      console.log('--- Missing Requirements ---');
      report.missingRequirements.forEach((item, i) => console.log(`${i + 1}. ${item}`));
      console.log('');
    }

    if (report.recommendations.length > 0) {
      console.log('--- Recommendations & Next Steps ---');
      report.recommendations.forEach((item) => console.log(`• ${item}`));
      console.log('');
    }

    console.log('===============================================================');
  } catch (error: any) {
    console.error('Diagnostic check error:', error?.message || error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
