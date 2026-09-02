'use client';

import { useState, useEffect } from 'react';
import { Zap, Crown, Shield } from 'lucide-react';
import { useSession } from 'next-auth/react';

export default function CreditBadge() {
  const { data: session, status } = useSession();
  const [credits, setCredits] = useState<number | null>(null);
  const [tier, setTier] = useState<'free' | 'pro'>('free');

  const fetchCredits = () => {
    const userEmail = session?.user?.email;

    if (status === 'unauthenticated' && !userEmail) {
      setCredits(10.0);
      setTier('free');
      return;
    }

    const headers: Record<string, string> = {};
    if (userEmail) headers['x-user-email'] = userEmail;

    fetch('/api/user-credits', { headers })
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.aiCredits === 'number') {
          setCredits(data.aiCredits);
          setTier(data.tier);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchCredits();
    
    const handleUpdate = (e: any) => {
      if (e?.detail?.remainingCredits !== undefined) {
        setCredits(e.detail.remainingCredits);
      } else {
        fetchCredits();
      }
    };

    window.addEventListener('user-credits-updated', handleUpdate);
    const interval = setInterval(fetchCredits, 10000);

    return () => {
      window.removeEventListener('user-credits-updated', handleUpdate);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  // Do not show credit badge at all if user is unauthenticated / logged out
  if (status === 'unauthenticated' || !session?.user?.email) {
    return null;
  }

  const openPricing = () => {
    window.dispatchEvent(new CustomEvent('open-pricing-modal'));
  };

  if ((session?.user as any)?.role === 'ADMIN') {
    return (
      <button
        onClick={() => window.location.href = '/admin'}
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.2))',
          border: '1px solid rgba(245,158,11,0.4)',
          color: '#f59e0b',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '0.78rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
        }}
      >
        <Shield size={14} color="#f59e0b" /> Admin
      </button>
    );
  }

  if (tier === 'pro') {
    return (
      <button
        onClick={openPricing}
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(56,189,248,0.2))',
          border: '1px solid rgba(99,102,241,0.4)',
          color: '#818cf8',
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '0.78rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          cursor: 'pointer',
        }}
      >
        <Crown size={14} color="#fbbf24" /> Pro Member
      </button>
    );
  }

  return (
    <button
      onClick={openPricing}
      style={{
        background: (credits !== null && credits < 2.0) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(251, 191, 36, 0.12)',
        border: (credits !== null && credits < 2.0) ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(251, 191, 36, 0.3)',
        color: (credits !== null && credits < 2.0) ? '#f87171' : '#fbbf24',
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '0.78rem',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      }}
      title="Click to view AI Credits balance or Upgrade to Pro"
    >
      <Zap size={14} fill={(credits !== null && credits < 2.0) ? '#f87171' : '#fbbf24'} />
      {credits !== null ? `${credits.toFixed(1)}/10.0 Credits` : '10.0 Credits'}
    </button>
  );
}
