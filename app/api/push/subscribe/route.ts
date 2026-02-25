import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// Save a push subscription
export async function POST(req: Request) {
    try {
        const { userId, subscription } = await req.json();

        if (!userId || !subscription?.endpoint || !subscription?.keys) {
            return new NextResponse("Missing userId or subscription data", { status: 400 });
        }

        const { endpoint, keys } = subscription;

        // Upsert: delete existing subscription with same endpoint, then insert new one
        await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, endpoint));

        await db.insert(pushSubscriptions).values({
            userId,
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Push subscribe error:', error);
        return new NextResponse(error.message, { status: 500 });
    }
}

// Remove a push subscription
export async function DELETE(req: Request) {
    try {
        const { endpoint } = await req.json();

        if (!endpoint) {
            return new NextResponse("Missing endpoint", { status: 400 });
        }

        await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, endpoint));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
