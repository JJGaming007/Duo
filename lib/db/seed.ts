import { db } from './index';
import { users } from './schema';
import { eq } from 'drizzle-orm';
import { PARTNER_A_NAME, PARTNER_B_NAME } from '@/lib/constants';

export async function seedUsers() {
    const existing = await db.select().from(users);

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
