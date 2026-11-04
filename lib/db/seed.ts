import { db } from './index';
import { users } from './schema';
import { PARTNER_A_NAME, PARTNER_B_NAME } from '@/lib/constants';

// Only needs to succeed once per server instance
let seeded: Promise<void> | null = null;

export function seedUsers() {
    if (!seeded) seeded = doSeed().catch((e) => { seeded = null; throw e; });
    return seeded;
}

async function doSeed() {
    // Select only `id`: selecting all schema columns would fail before
    // ensureSchema() has added newer columns (e.g. mood_emoji).
    const existing = await db.select({ id: users.id }).from(users);

    if (existing.length < 2) {
        console.log('Seeding hardcoded Duo users...');

        // Check user-1
        if (!existing.find(u => u.id === 'user-1')) {
            await db.insert(users).values({ id: 'user-1', name: PARTNER_A_NAME });
        }

        // Check user-2
        if (!existing.find(u => u.id === 'user-2')) {
            await db.insert(users).values({ id: 'user-2', name: PARTNER_B_NAME });
        }
    }
}
