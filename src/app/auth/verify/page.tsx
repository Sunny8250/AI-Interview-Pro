'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ShieldCheck, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import styles from '../login/page.module.css';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, update } = useSession();

  // Always start with '' on server AND client to avoid hydration mismatch.
  // useEffect populates it client-side from URL params or localStorage.
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [timer, setTimer] = useState(60);

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    // URL param is highest priority, then session
    const qEmail = searchParams.get('email');
    const _qCode = searchParams.get('code');
    const resolvedEmail =
      qEmail ||
      session?.user?.email ||
      '';

    if (resolvedEmail) setEmail(resolvedEmail);
  }, [searchParams, session]);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(prev => prev - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      const digits = pasted.split('');
      setCode(digits);
      inputRefs[5].current?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setSuccessMsg(data.message || 'Account verified successfully!');

      await update({ isVerified: true });

      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0 || resending) return;
    setResending(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to resend code');

      setSuccessMsg(data.message || 'New verification code sent!');

      setTimer(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <main className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '16px', background: 'rgba(34, 197, 94, 0.12)', color: '#4ade80', marginBottom: '1rem' }}>
            <ShieldCheck size={32} />
          </div>
          <h1>Verify Your Email</h1>
          <p>
            We've sent a 6-digit OTP verification code to{' '}
            <strong style={{ color: '#f8fafc' }}>{email || 'your email'}</strong>
          </p>
        </div>



        {error && <div className={styles.error}>{error}</div>}
        {successMsg && (
          <div style={{ background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#4ade80', padding: '0.75rem', borderRadius: '12px', textAlign: 'center', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#4ade80" /> {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '1rem 0 1.5rem' }}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                onPaste={handlePaste}
                style={{
                  width: '46px',
                  height: '54px',
                  textAlign: 'center',
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  borderRadius: '12px',
                  border: digit ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#f8fafc',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem' }} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify & Access App'}
            <ArrowRight size={18} style={{ marginLeft: '8px' }} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Didn't receive the code?{' '}
          <button
            onClick={handleResend}
            disabled={timer > 0 || resending}
            style={{
              background: 'none',
              border: 'none',
              color: timer > 0 ? '#64748b' : '#38bdf8',
              fontWeight: 700,
              cursor: timer > 0 ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '4px',
            }}
          >
            <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
            {timer > 0 ? `Resend Code in ${timer}s` : 'Resend Code'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Wrong account?{' '}
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 600, cursor: 'pointer', marginLeft: '4px', fontSize: '0.88rem', padding: 0 }}
          >
            Sign in with another email
          </button>
        </div>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>Loading verification...</div>}>
      <VerifyForm />
    </Suspense>
  );
}
