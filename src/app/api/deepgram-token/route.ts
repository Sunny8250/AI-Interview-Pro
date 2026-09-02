/**
 * CRIT-02 Fix: Return a short-lived Deepgram token instead of the master API key.
 *
 * The master DEEPGRAM_API_KEY never leaves the server. We call Deepgram's
 * /v1/auth/token endpoint to mint a temporary token (1-hour TTL) and return
 * only that to the browser. Even if a user extracts it from DevTools, it
 * expires in an hour and is scoped to the streaming API only.
 */
import { NextResponse } from 'next/server';
import { getClientIp } from '@/lib/ipHelper';
import { checkRateLimit } from '@/lib/rateLimit';
import { requireActiveUser } from '@/lib/authorization';
import crypto from 'crypto';

export async function GET(request: Request) {
  // Require an active session — unauthenticated callers get nothing
  const activeUser = await requireActiveUser();
  if (!activeUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const email = activeUser.user.email;
  const emailHash = crypto.createHash('sha256').update(email).digest('hex');
  const rateCheck = await checkRateLimit(`deepgram_token_${emailHash}_${ip}`, 10, 60 * 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many speech-token requests. Please try again later.' }, { status: 429 });
  }

  const masterKey = process.env.DEEPGRAM_API_KEY;
  if (!masterKey) {
    return NextResponse.json({ error: 'Speech service not configured' }, { status: 503 });
  }

  try {
    // Mint a short-lived token from Deepgram's API (1-hour TTL)
    const tokenResponse = await fetch('https://api.deepgram.com/v1/auth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${masterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: 'browser-session',
        time_to_live_in_seconds: 3600, // 1 hour
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error('Deepgram token mint failed:', tokenResponse.status, errBody);
      // Fallback: if Deepgram's token endpoint is unavailable, deny rather than
      // expose the master key.
      return NextResponse.json(
        { error: 'Speech service temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    }

    const data = await tokenResponse.json();
    const tempKey = data?.key;

    if (!tempKey) {
      console.error('Deepgram token response missing key field:', data);
      return NextResponse.json({ error: 'Failed to provision speech token' }, { status: 503 });
    }

    // Return only the short-lived token — master key stays server-side
    return NextResponse.json({ key: tempKey });
  } catch (err) {
    console.error('Deepgram token endpoint error:', err);
    return NextResponse.json(
      { error: 'Speech service temporarily unavailable. Please try again.' },
      { status: 503 }
    );
  }
}
