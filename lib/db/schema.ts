import { pgTable, text, integer, boolean, timestamp, date, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Simple Users table for hardcoded Duo
export const users = pgTable('users', {
    id: text('id').primaryKey().notNull(), // 'user-1' or 'user-2'
    name: text('name').notNull(),
    image: text('image'),
    xp: integer('xp').default(0),
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
});

// Playground state
export const playground = pgTable('playground', {
    id: text('id').primaryKey().default('default'),
    code: text('code').notNull().default('print("Hello Achu!")'),
    lastEditedBy: text('last_edited_by').references(() => users.id),
    updatedAt: timestamp('updated_at').defaultNow(),
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
