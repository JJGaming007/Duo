import { db } from "@/lib/db";
import { dailyProgress, streaks, users } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { eq, desc, and, not } from "drizzle-orm";
import { seedUsers } from "@/lib/db/seed";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) return new NextResponse("User ID required", { status: 400 });

    await seedUsers();

    // 1. Fetch user progress
    const progressList = await db.select().from(dailyProgress).where(eq(dailyProgress.userId, userId));

    // 2. Fetch user streak
    const userStreakRecord = await db.query.streaks.findFirst({
        where: eq(streaks.userId, userId)
    });

    // 3. Fetch partner stats
    const allProgress = await db.select().from(dailyProgress);
    const userCount = progressList.length;
    const partnerCount = allProgress.length - userCount;

    const totalMinutes = progressList.reduce((acc, curr) => acc + (curr.timeSpentMinutes || 0), 0);

    return NextResponse.json({
        totalDays: userCount,
        totalMinutes,
        completionRate: Math.round((userCount / 100) * 100),
        currentStreak: userStreakRecord?.currentStreak || 0,
        longestStreak: userStreakRecord?.longestStreak || 0,
        userCount,
        partnerCount,
        recentProgress: progressList.slice(-7).map(p => ({
            day: p.courseDay,
            time: p.timeSpentMinutes
        }))
    });
}
