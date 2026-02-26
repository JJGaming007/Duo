import { db } from "@/lib/db";
import { dailyProgress, streaks, users } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { pusherServer } from "@/lib/pusher";
import { seedUsers } from "@/lib/db/seed";
import { sendPushToPartner } from "@/lib/webpush";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) return new NextResponse("User ID required", { status: 400 });

    const progress = await db.select().from(dailyProgress).where(eq(dailyProgress.userId, userId));
    return NextResponse.json(progress);
}

export async function POST(req: Request) {
    const body = await req.json();
    const { userId, courseDay, watched, practiced, projectDone, timeSpentMinutes, notes } = body;

    if (!userId) return new NextResponse("User ID required", { status: 400 });

    const today = new Date().toISOString().split('T')[0];

    try {
        // 1. Save progress
        await db.insert(dailyProgress).values({
            userId,
            courseDay,
            watched,
            practiced,
            projectDone,
            timeSpentMinutes,
            notes,
            date: today,
        }).onConflictDoUpdate({
            target: [dailyProgress.userId, dailyProgress.courseDay],
            set: { watched, practiced, projectDone, timeSpentMinutes, notes, date: today }
        });

        // 2. Update Streak (with proper consecutive-day checking)
        const userStreak = await db.query.streaks.findFirst({
            where: eq(streaks.userId, userId)
        });

        let newStreak = 1;
        if (userStreak?.lastCompletedDate) {
            const lastDate = new Date(userStreak.lastCompletedDate);
            const todayDate = new Date(today);
            const diffMs = todayDate.getTime() - lastDate.getTime();
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                // Same day re-submission — keep streak unchanged
                newStreak = userStreak.currentStreak || 1;
            } else if (diffDays === 1) {
                // Consecutive day — increment streak
                newStreak = (userStreak.currentStreak || 0) + 1;
            }
            // diffDays > 1: streak resets to 1 (default)
        }
        const newLongest = Math.max(userStreak?.longestStreak || 0, newStreak);

        await db.insert(streaks).values({
            userId,
            currentStreak: newStreak,
            longestStreak: newLongest,
            lastCompletedDate: today,
        }).onConflictDoUpdate({
            target: [streaks.userId],
            set: { currentStreak: newStreak, longestStreak: newLongest, lastCompletedDate: today, updatedAt: new Date() }
        });


        // 3. Increment XP
        let xpToAdd = 0;
        if (watched) xpToAdd += 50;
        if (practiced) xpToAdd += 50;
        if (projectDone) xpToAdd += 100;

        if (xpToAdd > 0) {
            const userRecord = await db.query.users.findFirst({ where: eq(users.id, userId) });
            await db.update(users).set({ xp: (userRecord?.xp || 0) + xpToAdd }).where(eq(users.id, userId));
        }

        // 4. Trigger Realtime Notification
        const { getUserName } = await import('@/lib/constants');
        const userName = getUserName(userId);
        await pusherServer.trigger('partner-progress', 'log-complete', {
            userId,
            userName,
        });

        // 5. Web Push to partner (works when app is closed)
        await sendPushToPartner(
            userId,
            '🚀 Partner Update',
            `${userName} just completed Day ${courseDay}!`,
            '/dashboard'
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
