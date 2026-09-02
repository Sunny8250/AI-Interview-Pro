import { NextResponse } from 'next/server';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { requireActiveUser } from '@/lib/authorization';

const MAX_PUBLIC_REPORT_BYTES = 32 * 1024;
const SHARE_TTL_DAYS = 30;

function boundedText(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
    ? value.trim()
    : null;
}

function score(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? Math.round(value)
    : null;
}

function textList(value: unknown, maxItems: number, maxItemLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const values = value.map((item) => boundedText(item, maxItemLength));
  return values.every((item): item is string => item !== null) ? values : null;
}

export async function POST(request: Request) {
  try {
    const activeUser = await requireActiveUser();
    if (!activeUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (JSON.stringify(body).length > MAX_PUBLIC_REPORT_BYTES) {
      return NextResponse.json({ error: 'Report is too large to share' }, { status: 413 });
    }

    const role = boundedText(body?.role, 100);
    const experience = boundedText(body?.experience, 50) || 'Not specified';
    const report = body?.report;
    const summary = boundedText(report?.summary, 2_000);
    const overallScore = score(report?.overallScore);
    const strengths = textList(report?.strengths, 10, 500);
    const areasToImprove = textList(report?.areasToImprove, 10, 500);

    if (!role || !summary || overallScore === null || !strengths || !areasToImprove) {
      return NextResponse.json({ error: 'Report is incomplete or invalid' }, { status: 400 });
    }

    const db = mongoose.connection.db;
    if (!db) return NextResponse.json({ error: 'Database connection failed' }, { status: 503 });

    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000);
    await db.collection('public_reports').insertOne({
      _id: id,
      ownerId: activeUser.user._id,
      role,
      experience,
      report: {
        overallScore,
        communicationScore: score(report.communicationScore),
        technicalScore: score(report.technicalScore),
        confidenceScore: score(report.confidenceScore),
        summary,
        strengths,
        areasToImprove,
      },
      createdAt: new Date(),
      expiresAt,
    });

    return NextResponse.json({ id, expiresAt: expiresAt.toISOString() }, { status: 201 });
  } catch (error) {
    console.error('Failed to create public report:', error);
    return NextResponse.json({ error: 'Unable to create public report' }, { status: 500 });
  }
}
