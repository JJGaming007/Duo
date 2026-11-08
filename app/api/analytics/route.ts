import { db } from "@/lib/db";
import { currentUser, unauthorized } from '@/lib/auth/server';
import { dailyProgress, streaks, users } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { eq, asc, count } from "drizzle-orm";
import { seedUsers } from "@/lib/db/seed";

export async function GET() {
    const userId = await currentUser();
    if (!userId) return unauthorized();

    await seedUsers();

    const [progressList, userStreakRecord, [{ total }]] = await Promise.all([
        db.select().from(dailyProgress).where(eq(dailyProgress.userId, userId)).orderBy(asc(dailyProgress.courseDay)),
        db.query.streaks.findFirst({ where: eq(streaks.userId, userId) }),
        db.select({ total: count() }).from(dailyProgress),
    ]);
    const userCount = progressList.length;
    const partnerCount = Number(total) - userCount;

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
