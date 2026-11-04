import { sql } from 'drizzle-orm';
import { db } from './index';
import { seedUsers } from './seed';

// Idempotent DDL for the tables/columns added in the prayer + chat rework, so a
// deploy works against the existing database without a manual migration step.
// Mirrors lib/db/schema.ts (you can also run `npx drizzle-kit push`).
const TABLES = [
    `CREATE TABLE IF NOT EXISTS prayer_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date date NOT NULL,
        count integer NOT NULL DEFAULT 0,
        updated_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS prayer_subjects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL,
        notes text,
        created_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        for_whom text NOT NULL DEFAULT 'both',
        prayed_count integer NOT NULL DEFAULT 0,
        last_prayed_at timestamp,
        answered_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS images (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        data text NOT NULL,
        mime text NOT NULL,
        width integer NOT NULL DEFAULT 0,
        height integer NOT NULL DEFAULT 0,
        created_by text REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamp NOT NULL DEFAULT now()
    )`,
    `ALTER TABLE love_notes ADD COLUMN IF NOT EXISTS reply_to_id uuid`,
    `ALTER TABLE love_notes ADD COLUMN IF NOT EXISTS image_id uuid`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS image text`,
    `ALTER TABLE love_notes ADD COLUMN IF NOT EXISTS read_at timestamp`,
    `ALTER TABLE love_notes ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '{}'::jsonb`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS mood_emoji text`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS mood_label text`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS mood_updated_at timestamp`,
];
const INDEXES = [
    `CREATE UNIQUE INDEX IF NOT EXISTS prayer_logs_user_date_unique ON prayer_logs (user_id, date)`,
    `CREATE INDEX IF NOT EXISTS love_notes_created_at_idx ON love_notes (created_at)`,
];

let ready: Promise<void> | null = null;

export function ensureSchema() {
    if (!ready) {
        ready = (async () => {
            // DDL first: any query through the drizzle schema (even seeding)
            // selects the new columns and fails until they exist.
            for (const stmt of TABLES) await db.execute(sql.raw(stmt));
            await Promise.all(INDEXES.map((stmt) => db.execute(sql.raw(stmt))));
            await seedUsers();
        })().catch((e) => {
            ready = null;
            throw e;
        });
    }
    return ready;
}
