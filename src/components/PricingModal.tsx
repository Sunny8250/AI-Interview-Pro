'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Check, Zap, X, Star, Lock, Gift, Flame, Copy, Clock } from 'lucide-react';

export default function PricingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [_userTier, setUserTier] = useState<'free' | 'pro'>('free');
  const [loginStreak, setLoginStreak] = useState<number>(1);
  const [referralCode, setReferralCode] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minute urgency timer

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-pricing-modal', handleOpen);

    fetch('/api/user-credits')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.aiCredits === 'number') {
          setUserCredits(data.aiCredits);
          setUserTier(data.tier);
          if (data.loginStreak) setLoginStreak(data.loginStreak);
          if (data.referralCode) setReferralCode(data.referralCode);
        }
      })
      .catch(() => {});

    return () => window.removeEventListener('open-pricing-modal', handleOpen);
  }, []);

  // Urgency timer countdown
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && (window as any).Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCheckout = async (plan: 'pro' | 'topup') => {
    try {
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plan, planType: billingCycle }),
      });
      const data = await res.json();

      if (res.ok && data.orderId && data.keyId) {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          alert('Failed to load Razorpay payment gateway. Please check your internet connection.');
          return;
        }

        const options = {
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          name: 'AI Interview Pro',
          description: data.description,
          order_id: data.orderId,
          prefill: {
            email: data.userEmail,
          },
          theme: {
            color: '#6366f1',
          },
          handler: async function (response: any) {
            const verifyRes = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userEmail: data.userEmail,
                plan,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              alert(verifyData.message);
              if (verifyData.newCredits !== undefined) {
                setUserCredits(verifyData.newCredits);
                window.dispatchEvent(new CustomEvent('user-credits-updated', { detail: { remainingCredits: verifyData.newCredits } }));
              }
              if (verifyData.tier) setUserTier(verifyData.tier);
              setIsOpen(false);
            } else {
              alert(verifyData.error || 'Payment verification failed!');
            }
          },
        };

        const razorpayWindow = new (window as any).Razorpay(options);
        razorpayWindow.open();
        return;
      }

      if (data.code === 'RAZORPAY_KEYS_MISSING') {
        alert(`⚠️ Razorpay Payment Gateway Setup Required:\n\n${data.error}\n\nTo accept real payments via UPI, Paytm, GPay, and Cards, please add your Razorpay API keys to .env.local.`);
        return;
      }

      alert(data.error || 'Payment initiation failed');
    } catch (err: any) {
      alert(err.message || 'Payment initiation failed');
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/auth/signup?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(12px)',
      padding: '2rem 1rem',
      overflowY: 'auto',
    }}>
      <div style={{
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.99))',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        borderRadius: '24px',
        maxWidth: '740px',
        width: '95%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 50px rgba(99, 102, 241, 0.25)',
        padding: '1.5rem 1.75rem',
        position: 'relative',
        color: '#f8fafc',
        margin: 'auto 0',
      }}>
        {/* Close button */}
        <button
          onClick={() => setIsOpen(false)}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#cbd5e1',
            cursor: 'pointer',
            zIndex: 10,
          }}
          title="Close"
        >
          <X size={18} />
        </button>

        {/* Urgency Discount Banner */}
        <div style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.2), rgba(245,158,11,0.2))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '0.5rem 0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', fontSize: '0.82rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#fbbf24' }}>
            <Clock size={15} /> ⚡ Limited Time Offer: Save 47% on Pro Annual Pass
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '6px', fontWeight: 800, color: '#f87171', fontFamily: 'monospace' }}>
            Offer Expires: {formatTimer(timeLeft)}
          </div>
        </div>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '1rem', paddingRight: '1rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '3px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <Sparkles size={14} /> AI Pro Membership & Credit Hub
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.3rem', background: 'linear-gradient(135deg, #f8fafc, #818cf8, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.25 }}>
            Unlock Unlimited AI Mock Interviews & Target Company Prep
          </h2>
          <div style={{ color: '#94a3b8', fontSize: '0.88rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            {userCredits !== null && (
              <span>Current Balance: <strong style={{ color: '#fbbf24' }}>⚡ {userCredits.toFixed(1)} / 10.0 Credits</strong></span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontWeight: 700 }}>
              <Flame size={15} fill="#f59e0b" /> {loginStreak}-Day Daily Streak (+0.5 Credit/Day)
            </span>
          </div>
        </div>

        {/* Billing Cycle Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: '5px 14px',
                borderRadius: '7px',
                border: 'none',
                background: billingCycle === 'monthly' ? '#6366f1' : 'transparent',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              Monthly ($19/mo)
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              style={{
                padding: '5px 14px',
                borderRadius: '7px',
                border: 'none',
                background: billingCycle === 'annual' ? '#6366f1' : 'transparent',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              Annual ($9.99/mo) <span style={{ background: '#4ade80', color: '#0f172a', fontSize: '0.68rem', padding: '1px 5px', borderRadius: '5px', fontWeight: 800 }}>SAVE 47%</span>
            </button>
          </div>
        </div>

        {/* Free vs Pro Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
          {/* Free Tier */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '14px', padding: '1rem' }}>
            <div style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.98rem', marginBottom: '0.2rem' }}>Free Starter</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.75rem' }}>$0 <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#64748b' }}>/ forever</span></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.82rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#4ade80" /> 10.0 Shared Monthly AI Credits</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#4ade80" /> +0.5 Daily Login Streak Bonus</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.5 }}><Lock size={14} /> Company Modes (Google/Amazon)</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.5 }}><Lock size={14} /> PDF Cheat Sheet Export</li>
            </ul>
          </div>

          {/* Pro Tier */}
          <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(56,189,248,0.12))', border: '1px solid rgba(99,102,241,0.45)', borderRadius: '14px', padding: '1rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-9px', right: '10px', background: 'linear-gradient(135deg, #6366f1, #38bdf8)', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '8px', textTransform: 'uppercase' }}>BEST VALUE</div>
            <div style={{ fontWeight: 700, color: '#818cf8', fontSize: '0.98rem', marginBottom: '0.2rem' }}>Pro Membership</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.75rem' }}>
              {billingCycle === 'annual' ? '$9.99' : '$19'} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#94a3b8' }}>/ month</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.82rem', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#4ade80" /> <strong>UNLIMITED AI Credits</strong></li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#4ade80" /> OpenAI GPT-4o & Grok-2</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#4ade80" /> Google, Amazon & Meta Modes</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#4ade80" /> Full PDF Cheat Sheet Export</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons: Pro Upgrade + Top-Up Pack */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button
            onClick={() => handleCheckout('pro')}
            style={{
              flex: 2,
              minWidth: '220px',
              padding: '0.75rem',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
              color: '#ffffff',
              fontSize: '0.92rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Star size={16} fill="#ffffff" /> Upgrade to Pro Membership
          </button>

          <button
            onClick={() => handleCheckout('topup')}
            style={{
              flex: 1,
              minWidth: '170px',
              padding: '0.75rem',
              borderRadius: '12px',
              border: '1px solid rgba(251, 191, 36, 0.4)',
              background: 'rgba(251, 191, 36, 0.12)',
              color: '#fbbf24',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
            }}
          >
            <Zap size={15} fill="#fbbf24" /> Top-Up +25 Credits ($4.99)
          </button>
        </div>

        {/* Viral Referral Banner */}
        {referralCode && (
          <div style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '0.75rem 1rem', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Gift size={15} /> Earn Free Credits (Referral Program)
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Share your invite link with friends. You both get <strong>+5.0 Free AI Credits</strong> on signup!
              </div>
            </div>
            <button
              onClick={copyReferralLink}
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#4ade80',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Copy size={13} /> {copied ? 'Link Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
