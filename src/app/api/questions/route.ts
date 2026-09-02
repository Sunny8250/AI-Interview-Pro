import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import QuestionBank from '@/models/QuestionBank';
import { requireActiveUser } from '@/lib/authorization';

// LOW-02 Fix: Added pagination to prevent fetching the entire collection at once.
// Unbounded .find() on a large collection causes memory exhaustion and slow responses.
export async function GET(request: NextRequest) {
  try {
    if (!(await requireActiveUser())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const [questions, total] = await Promise.all([
      QuestionBank.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      QuestionBank.countDocuments(),
    ]);

    return NextResponse.json({
      questions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching public questions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
