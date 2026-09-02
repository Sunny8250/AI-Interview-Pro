'use client';
import { signOut } from 'next-auth/react';
import { ShieldAlert } from 'lucide-react';

export default function BannedScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      <div className="glass-panel" style={{ padding: '40px', borderRadius: '16px', textAlign: 'center', maxWidth: '400px' }}>
        <ShieldAlert size={64} color="var(--error)" style={{ margin: '0 auto 20px' }} />
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '16px', color: 'var(--error)' }}>Account Suspended</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.6' }}>
          Your account has been banned due to a violation of our terms of service. You no longer have access to this application.
        </p>
        <button 
          onClick={() => signOut({ callbackUrl: '/' })}
          className="btn hover-lift"
          style={{ padding: '10px 24px', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--error)', fontWeight: 700, borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.4)' }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
