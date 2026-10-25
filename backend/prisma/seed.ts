import { PrismaClient, Role, SyncStatus, CallStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Shiavnski Voice Agent Management System demo data...');

  // 1. Create or retrieve Demo Admin User
  const demoEmail = 'demo@shiavnski.com';
  const existingUser = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  let userId: string;
  if (!existingUser) {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const user = await prisma.user.create({
      data: {
        email: demoEmail,
        passwordHash,
        fullName: 'Demo Evaluation Admin',
        role: Role.ADMIN,
      },
    });
    userId = user.id;
    console.log(`Created demo user: ${demoEmail} (Password: Password123!)`);
  } else {
    userId = existingUser.id;
    console.log(`Demo user already exists: ${demoEmail}`);
  }

  // 2. Create Sample Agents if not present
  const existingAgents = await prisma.agent.findMany({
    where: { userId },
  });

  let primaryAgentId: string;
  if (existingAgents.length === 0) {
    const agent1 = await prisma.agent.create({
      data: {
        userId,
        name: 'Healthcare Appointment Assistant',
        description: 'Automates patient scheduling, reminders, and calendar coordination.',
        voiceId: '11labs-Adrian',
        language: 'en-US',
        systemPrompt: 'You are a warm, professional healthcare scheduling assistant for City Health Clinic.',
        responsiveness: 1.0,
        interruptionSensitivity: 0.8,
        syncStatus: SyncStatus.SYNCED,
        providerAgentId: 'agent_mock_healthcare_01',
        isActive: true,
      },
    });

    const agent2 = await prisma.agent.create({
      data: {
        userId,
        name: 'Customer Support Bot',
        description: 'Handles product inquiries, order tracking, and general customer support.',
        voiceId: '11labs-Rachel',
        language: 'en-US',
        systemPrompt: 'You are a patient customer support representative assisting users with orders.',
        responsiveness: 0.9,
        interruptionSensitivity: 0.7,
        syncStatus: SyncStatus.SYNCED,
        providerAgentId: 'agent_mock_support_02',
        isActive: true,
      },
    });

    primaryAgentId = agent1.id;
    console.log(`Created sample agents: "${agent1.name}" and "${agent2.name}"`);
  } else {
    primaryAgentId = existingAgents[0].id;
    console.log(`Existing agents found (${existingAgents.length} agents).`);
  }

  // 2b. Seed or sync published Retell Agent ID
  const retellAgentId = 'agent_ba6661e78710d75a9fe62d6451';
  const existingRetellAgent = await prisma.agent.findFirst({
    where: { providerAgentId: retellAgentId },
  });

  if (!existingRetellAgent) {
    const liveAgent = await prisma.agent.create({
      data: {
        userId,
        name: 'Shiavnski AI Assistant',
        description: 'Official Shiavnski Technologies live voice concierge agent configured in Retell AI.',
        voiceId: 'retell-Cimo',
        language: 'en-US',
        systemPrompt: `# Role\nYou are the AI Voice Assistant for Shiavnski Technologies.\n\n# Objective\nHelp callers with general enquiries about the company, its software services, and how to contact the team.\n\n# Personality\n- Speak in a friendly, professional, calm, and natural manner.\n- Use clear, simple English.\n- Keep responses short and conversational.\n- Ask one question at a time.\n- Never interrupt the caller unnecessarily.`,
        responsiveness: 1.0,
        interruptionSensitivity: 0.9,
        syncStatus: SyncStatus.SYNCED,
        providerAgentId: retellAgentId,
        isActive: true,
      },
    });
    primaryAgentId = liveAgent.id;
    console.log(`Seeded live Retell agent in PostgreSQL: "${liveAgent.name}" (${retellAgentId})`);
  } else {
    primaryAgentId = existingRetellAgent.id;
    console.log(`Live Retell agent already exists in PostgreSQL: ${retellAgentId}`);
  }

  // 3. Create Sample Call Records if none exist for this user
  const existingCalls = await prisma.call.count({
    where: { userId },
  });

  if (existingCalls === 0) {
    const now = new Date();
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000);

    // Call 1: Completed Call with simulated metrics
    await prisma.call.create({
      data: {
        userId,
        agentId: primaryAgentId,
        providerCallId: `call_mock_seed_${Date.now()}_1`,
        fromNumber: '+14155551234',
        toNumber: '+14155552671',
        status: CallStatus.ENDED,
        durationSeconds: 124,
        disconnectionReason: 'simulated_user_hangup',
        summary: 'Caller inquired about office opening hours and successfully confirmed appointment for Friday at 10:00 AM.',
        sentiment: 'Positive',
        callSuccessful: true,
        dynamicVariables: {
          patient_name: 'Alex Johnson',
          appointment_type: 'Dental Checkup',
        },
        startedAt: tenMinAgo,
        endedAt: new Date(tenMinAgo.getTime() + 124 * 1000),
      },
    });

    // Call 2: Freshly Initiated Call
    await prisma.call.create({
      data: {
        userId,
        agentId: primaryAgentId,
        providerCallId: `call_mock_seed_${Date.now()}_2`,
        fromNumber: '+14155551234',
        toNumber: '+12025550143',
        status: CallStatus.INITIATED,
        durationSeconds: 0,
        dynamicVariables: {
          client_tier: 'Enterprise VIP',
        },
        startedAt: twoMinAgo,
      },
    });

    console.log('Created sample call records for immediate dashboard and history evaluation.');
  } else {
    console.log(`Existing call records found (${existingCalls} calls).`);
  }

  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
