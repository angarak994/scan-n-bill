import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { processAIQuery } from '@/lib/services/aiAssistantService';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || !session.businessId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { query } = body;

        if (!query || typeof query !== 'string') {
            return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
        }

        const businessId = session.businessId;
        const responseText = await processAIQuery(query, businessId);
        
        return NextResponse.json({ response: responseText });
    } catch (err: any) {
        console.error('AI Assistant Error:', err);
        return NextResponse.json({ error: 'Failed to process AI query' }, { status: 500 });
    }
}
