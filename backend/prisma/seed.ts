import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  try {
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo@example.com' },
      update: {},
      create: {
        email: 'demo@example.com',
        username: 'demo_user',
        passwordHash: await bcrypt.hash('demo123', 10),
        firstName: 'Demo',
        lastName: 'User',
        isActive: true,
        isVerified: true,
        subscriptionTier: 'PRO',
        subscriptionEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days from now
      },
    });
    console.log('Demo user created:', demoUser);
  } catch (e) {
    console.error('Error seeding database:', e);
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1)
});
