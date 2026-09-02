import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { checkRateLimit } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/ipHelper';
import { connectToDatabase } from '@/lib/mongodb';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    const rateCheck = await checkRateLimit(`public_report_${getClientIp(request)}`, 60, 60_000);
    if (!rateCheck.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    await connectToDatabase();
    const activeDb = mongoose.connection.db;
    if (!activeDb) return NextResponse.json({ error: 'Report service unavailable' }, { status: 503 });

    const report = await activeDb.collection('public_reports').findOne(
      { _id: id, expiresAt: { $gt: new Date() } } as any,
      { projection: { _id: 0, ownerId: 0 } },
    );
    if (!report) return NextResponse.json({ error: 'Report not found or expired' }, { status: 404 });

    return NextResponse.json(report, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to fetch public report:', error);
    return NextResponse.json({ error: 'Report service unavailable' }, { status: 503 });
  }
}
