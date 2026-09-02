import { getClientIp } from '@/lib/ipHelper';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { checkAndDeductCredit, refundCredit } from '@/lib/creditGuard';
import { getRotatedGenAIClient } from '@/lib/gemini';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  let creditDeducted = false;
  let userEmailForRefund: string | null = null;
  let ipForRefund = 'guest';
  try {
    const clientObj = getRotatedGenAIClient();
    if (!clientObj) {
      return NextResponse.json({ error: 'AI provider keys are not configured.' }, { status: 500 });
    }
    const ai = clientObj.ai;

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }

    // HIGH-01 Fix: Validate MIME type against an allowlist.
    // The client-provided type is never trusted for routing decisions—only for passing
    // to the AI API after it has been validated here.
    const ALLOWED_AUDIO_TYPES = [
      'audio/webm',
      'audio/ogg',
      'audio/mp4',
      'audio/wav',
      'audio/wave',
      'audio/mpeg',
      'audio/mp3',
      'audio/x-wav',
    ];
    if (audioFile.type && !ALLOWED_AUDIO_TYPES.includes(audioFile.type.toLowerCase().split(';')[0].trim())) {
      return NextResponse.json(
        { error: `Unsupported audio format. Allowed: ${ALLOWED_AUDIO_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (audioFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 413 });
    }

    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    const ip = getClientIp(req);
    const rateCheck = await checkRateLimit(`transcribe_${userEmail?.toLowerCase().trim() || ip}`, 20, 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please try again in a minute.' }, { status: 429 });
    }

    const creditCheck = await checkAndDeductCredit(userEmail, 0.5, ip);
    if (!creditCheck.allowed) {
      return NextResponse.json({
        error: creditCheck.error || 'Insufficient AI Credits to transcribe audio.',
        code: 'OUT_OF_CREDITS',
      }, { status: 402 });
    }
    creditDeducted = true;
    userEmailForRefund = userEmail ?? null;
    ipForRefund = ip;

    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = audioFile.type || 'audio/webm';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            {
              text: 'Transcribe the speech in this audio file. Return ONLY the exact spoken words with correct spelling and punctuation. Do not add any commentary, explanation, or formatting. If the audio is silent or unclear, return an empty string.',
            },
          ],
        },
      ],
      config: { temperature: 0 },
    });

    const transcript = response.text?.trim() ?? '';
    return NextResponse.json({ 
      transcript,
      remainingCredits: creditCheck.remainingCredits,
    });
  } catch (err: any) {
    if (creditDeducted) {
      await refundCredit(userEmailForRefund, 0.5, ipForRefund);
    }
    console.error('Transcription error:', err);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
