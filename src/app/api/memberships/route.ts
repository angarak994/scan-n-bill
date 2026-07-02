import { NextResponse } from 'next/server';
import { getGoogleSheetsClient, appendRow } from '@/lib/googleSheets';
import { v4 as uuid } from 'uuid';

export async function GET(request: Request) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) throw new Error('Missing Spreadsheet ID');

    const sheets = await getGoogleSheetsClient();
    
    // Check if Memberships sheet has headers
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Memberships!A:H',
    });

    const rows = res.data.values || [];
    
    if (rows.length === 0) {
      // Add headers
      await appendRow('Memberships', ['ID', 'Name', 'Mobile', 'Email', 'Tier', 'Join Date', 'Expiry Date', 'Status']);
      return NextResponse.json({ memberships: [] });
    }

    // Parse rows into JSON (skip header)
    const memberships = rows.slice(1).map(row => ({
      id: row[0] || '',
      name: row[1] || '',
      mobile: row[2] || '',
      email: row[3] || '',
      tier: row[4] || 'Standard',
      join_date: row[5] || '',
      expiry_date: row[6] || '',
      status: row[7] || 'Active'
    })).filter(m => m.id);

    return NextResponse.json({ memberships });
  } catch (error: any) {
    console.error('Fetch Memberships Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, mobile, email, tier, duration_months } = await request.json();

    if (!name || !mobile) {
      return NextResponse.json({ error: 'Name and Mobile are required' }, { status: 400 });
    }

    const id = uuid();
    const joinDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (parseInt(duration_months) || 12));

    const newMember = [
      id,
      name,
      mobile,
      email || '',
      tier || 'Standard',
      joinDate.toISOString().split('T')[0],
      expiryDate.toISOString().split('T')[0],
      'Active'
    ];

    await appendRow('Memberships', newMember);
    
    // Log to Activity Log
    const { logActivityToSheet } = require('@/lib/googleSheets');
    await logActivityToSheet('NEW_MEMBERSHIP', {
      user: 'Club Owner',
      details: `Created ${tier} membership for ${name}`
    });

    return NextResponse.json({ success: true, member: { id, name, mobile, tier, join_date: newMember[5], expiry_date: newMember[6], status: 'Active' } });
  } catch (error: any) {
    console.error('Create Membership Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
