import { pgTable, text, integer, boolean, timestamp, date, uuid, uniqueIndex, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Simple Users table for hardcoded Duo
export const users = pgTable('users', {
    id: text('id').primaryKey().notNull(), // 'user-1' or 'user-2'
    name: text('name').notNull(),
    image: text('image'),
    xp: integer('xp').default(0),
    moodEmoji: text('mood_emoji'),
    moodLabel: text('mood_label'),
    moodUpdatedAt: timestamp('mood_updated_at'),
    lastSeenAt: timestamp('last_seen_at'),
});

// Daily progress table
export const dailyProgress = pgTable('daily_progress', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    courseDay: integer('course_day').notNull(),
    watched: boolean('watched').default(false),
    practiced: boolean('practiced').default(false),
    projectDone: boolean('project_done').default(false),
    timeSpentMinutes: integer('time_spent_minutes').default(0),
    notes: text('notes'),
    date: date('date').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    userDayUnique: uniqueIndex('user_day_unique').on(table.userId, table.courseDay),
}));

// Streaks table
export const streaks = pgTable('streaks', {
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
    currentStreak: integer('current_streak').default(0),
    longestStreak: integer('longest_streak').default(0),
    lastCompletedDate: date('last_completed_date'),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// Love Notes table
export const loveNotes = pgTable('love_notes', {
    id: uuid('id').defaultRandom().primaryKey(),
    senderId: text('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    replyToId: uuid('reply_to_id'),
    imageId: uuid('image_id'),
    audioId: uuid('audio_id'),
    deliveredAt: timestamp('delivered_at'),
    editedAt: timestamp('edited_at'),
    // "Delete for everyone": the row stays as a placeholder
    deletedAt: timestamp('deleted_at'),
    readAt: timestamp('read_at'),
    // { [userId]: emoji } — one reaction per person per message
    reactions: jsonb('reactions').$type<Record<string, string>>().default({}),
}, (table) => ({
    createdAtIdx: index('love_notes_created_at_idx').on(table.createdAt),
}));

// Uploaded images (chat photos + profile pictures), already resized on the client.
// Stored as base64 and served from /api/images/[id] with immutable caching.
export const images = pgTable('images', {
    id: uuid('id').defaultRandom().primaryKey(),
    data: text('data').notNull(),
    mime: text('mime').notNull(),
    width: integer('width').notNull().default(0),
    height: integer('height').notNull().default(0),
    // Voice messages
    durationMs: integer('duration_ms'),
    waveform: jsonb('waveform').$type<number[]>(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// How many times each person prayed on a given (local) day
export const prayerLogs = pgTable('prayer_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    date: date('date').notNull(),
    count: integer('count').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    userDateUnique: uniqueIndex('prayer_logs_user_date_unique').on(table.userId, table.date),
}));

// Shared prayer subjects (a to-do list of things to pray for)
export const prayerSubjects = pgTable('prayer_subjects', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    // 'both' | 'user-1' | 'user-2'
    forWhom: text('for_whom').notNull().default('both'),
    prayedCount: integer('prayed_count').notNull().default(0),
    lastPrayedAt: timestamp('last_prayed_at'),
    answeredAt: timestamp('answered_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Playground state
export const playground = pgTable('playground', {
    id: text('id').primaryKey().default('default'),
    code: text('code').notNull().default('print("Hello Achu!")'),
    lastEditedBy: text('last_edited_by').references(() => users.id),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// Web Push subscriptions
export const pushSubscriptions = pgTable('push_subscriptions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
    progress: many(dailyProgress),
    streak: one(streaks, {
        fields: [users.id],
        references: [streaks.userId],
    }),
    loveNotes: many(loveNotes),
    playgroundEdits: many(playground),
}));

export const playgroundRelations = relations(playground, ({ one }) => ({
    editor: one(users, {
        fields: [playground.lastEditedBy],
        references: [users.id],
    }),
}));

export const dailyProgressRelations = relations(dailyProgress, ({ one }) => ({
    user: one(users, {
        fields: [dailyProgress.userId],
        references: [users.id],
    }),
}));

export const loveNotesRelations = relations(loveNotes, ({ one }) => ({
    sender: one(users, {
        fields: [loveNotes.senderId],
        references: [users.id],
    }),
}));
