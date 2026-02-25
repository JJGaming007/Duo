import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { code } = await req.json();

        const response = await fetch('https://emkc.org/api/v2/piston/execute', {
            method: 'POST',
            body: JSON.stringify({
                language: 'python',
                version: '3.10.0',
                files: [
                    {
                        content: code,
                    },
                ],
            }),
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
