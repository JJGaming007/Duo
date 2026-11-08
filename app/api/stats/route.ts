import { db } from "@/lib/db";
import { currentUser, unauthorized } from '@/lib/auth/server';
import { dailyProgress, streaks, users } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { seedUsers } from "@/lib/db/seed";

export async function GET() {
    const userId = await currentUser();
    if (!userId) return unauthorized();

    const today = new Date().toISOString().split('T')[0];

    // Run all queries in parallel (each is a separate HTTP round-trip to Neon)
    const [allStreaks, todayProgress, latestProgress] = await Promise.all([
        db.select().from(streaks),
        db.query.dailyProgress.findFirst({
            where: and(eq(dailyProgress.userId, userId), eq(dailyProgress.date, today))
        }),
        db.query.dailyProgress.findFirst({
            where: eq(dailyProgress.userId, userId),
            orderBy: [desc(dailyProgress.courseDay)]
        }),
    ]);
    const userStreak = allStreaks.find(s => s.userId === userId)?.currentStreak || 0;
    const partnerStreak = allStreaks.find(s => s.userId !== userId)?.currentStreak || 0;

    return NextResponse.json({
        userStreak,
        partnerStreak,
        todayCompleted: !!todayProgress,
        courseDay: (latestProgress?.courseDay || 0) + (todayProgress ? 0 : 1),
    });
}
