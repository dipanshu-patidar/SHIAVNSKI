import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;

  console.log('PostgreSQL Public Tables:');
  tables.forEach((t) => console.log(` - ${t.table_name}`));

  const users = await prisma.user.findMany({ select: { id: true, email: true, fullName: true, role: true } });
  console.log('\nUsers in Database:', users.length);
  users.forEach((u) => console.log(` - [${u.id}] ${u.email} (${u.fullName})`));

  const agents = await prisma.agent.findMany();
  console.log('\nAgents in Database:', agents.length);
  agents.forEach((a) => console.log(` - [${a.id}] ${a.name} (providerAgentId: ${a.providerAgentId}, voiceId: ${a.voiceId})`));

  const callsCount = await prisma.call.count();
  console.log('\nCalls in Database:', callsCount);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Error querying tables:', e);
  await prisma.$disconnect();
  process.exit(1);
});
