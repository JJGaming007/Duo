import { db } from "@/lib/db";
import { dailyProgress, streaks, users } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { seedUsers } from "@/lib/db/seed";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) return new NextResponse("User ID required", { status: 400 });

    const today = new Date().toISOString().split('T')[0];

    // Fetch all streaks
    const allStreaks = await db.select().from(streaks);
    const userStreak = allStreaks.find(s => s.userId === userId)?.currentStreak || 0;
    const partnerStreak = allStreaks.find(s => s.userId !== userId)?.currentStreak || 0;

    // Fetch today's progress for user
    const todayProgress = await db.query.dailyProgress.findFirst({
        where: and(eq(dailyProgress.userId, userId), eq(dailyProgress.date, today))
    });

    // Fetch next suggested day
    const latestProgress = await db.query.dailyProgress.findFirst({
        where: eq(dailyProgress.userId, userId),
        orderBy: [desc(dailyProgress.courseDay)]
    });

    return NextResponse.json({
        userStreak,
        partnerStreak,
        todayCompleted: !!todayProgress,
        courseDay: (latestProgress?.courseDay || 0) + (todayProgress ? 0 : 1),
    });
}
