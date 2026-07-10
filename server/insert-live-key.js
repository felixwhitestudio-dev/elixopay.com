import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

async function main() {
    const rawKey = 'ep_live_755145722ec2fd6ddc2655d368f4a555aa2359a572ec00896a1e61c3d596b29f';
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 16) + '...';

    // Find the first user
    const user = await prisma.user.findFirst();
    if (!user) return console.log('No users found!');

    try {
        const apiKey = await prisma.apiKey.create({
            data: {
                userId: user.id,
                name: 'Carat Live Key',
                keyPrefix: keyPrefix,
                keyHash: keyHash,
                mode: 'live',
                isActive: true
            }
        });
        console.log('Inserted Live API Key:', apiKey);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
