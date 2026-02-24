import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { PARTNER_A_NAME, PARTNER_B_NAME } from '../lib/constants';

async function main() {
    console.log('Updating user names...');
    await db.update(users).set({ name: PARTNER_A_NAME }).where(eq(users.id, 'user-1'));
    await db.update(users).set({ name: PARTNER_B_NAME }).where(eq(users.id, 'user-2'));
    console.log('Done!');
    process.exit(0);
}

main().catch(console.error);
