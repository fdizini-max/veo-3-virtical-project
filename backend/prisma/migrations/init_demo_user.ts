async function main() {
    // Create demo user if doesn't exist
    const demoUser = await prisma.user.upsert({
        where: {
            email: 'demo@example.com',
        },
        update: {},
        create: {
            id: 'demo_user',
            email: 'demo@example.com',
            username: 'demo_user',
            passwordHash: 'demo', // In a real app, this would be properly hashed
            isActive: true,
            isVerified: true,
        },
    });

    console.log('Demo user created:', demoUser);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
