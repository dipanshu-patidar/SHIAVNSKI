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

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Error querying tables:', e);
  await prisma.$disconnect();
  process.exit(1);
});
