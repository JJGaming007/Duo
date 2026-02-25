import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { playground } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
    try {
        const state = await db.query.playground.findFirst({
            where: eq(playground.id, 'default'),
        });

        return NextResponse.json(state || { code: 'print("Hello Achu!")' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
