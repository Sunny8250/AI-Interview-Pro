'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Sun, Moon, Sparkles, LogIn, UserPlus } from 'lucide-react';
import { syncCloudData } from '@/lib/stats';
import CreditBadge from './CreditBadge';

export default function Navbar() {
  const { data: session, status } = useSession();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('app_theme') as 'dark' | 'light';
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      syncCloudData(session.user.email);
    }
  }, [session]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('app_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const isAuthenticated = status === 'authenticated';

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '1rem',
      padding: '1rem 2rem',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--glass-border)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <Link href={isAuthenticated ? "/dashboard" : "/auth/login"} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
        <Sparkles color="var(--primary-color)" size={24} />
        <span>AI Interview Pro</span>
      </Link>

      <nav style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap', fontSize: '0.9rem', fontWeight: 600 }}>
        {isAuthenticated ? (
          <>
            <Link href="/dashboard" style={{ color: 'var(--text-secondary)' }}>Dashboard</Link>
            <Link href="/interview/setup" style={{ color: 'var(--text-secondary)' }}>Mock Interview</Link>
            <Link href="/system-design" style={{ color: 'var(--text-secondary)' }}>System Design</Link>
            <Link href="/questions" style={{ color: 'var(--text-secondary)' }}>Questions</Link>
            <Link href="/interview/negotiate" style={{ color: 'var(--text-secondary)' }}>HR Negotiate</Link>
            <Link href="/analytics" style={{ color: 'var(--text-secondary)' }}>Analytics</Link>
            <Link href="/leaderboard" style={{ color: 'var(--text-secondary)' }}>Leaderboard</Link>
            <Link href="/resume" style={{ color: 'var(--text-secondary)' }}>ATS Resume</Link>
            <Link href="/tools/thank-you" style={{ color: 'var(--text-secondary)' }}>Thank You Tool</Link>

            {(session?.user as any)?.role === 'ADMIN' && (
              <Link href="/admin" style={{ color: 'var(--primary-color)', fontWeight: 700, padding: '4px 10px', background: 'var(--primary-color-20)', borderRadius: '6px' }}>
                Admin
              </Link>
            )}

            <CreditBadge />
          </>
        ) : (
          <>
            <Link href="/auth/login" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <LogIn size={16} /> Sign In
            </Link>
            <Link href="/auth/signup" className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserPlus size={16} /> Sign Up
            </Link>
          </>
        )}

        <button
          onClick={toggleTheme}
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: '9999px',
            padding: '6px 12px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem'
          }}
          title="Toggle Light / Dark Theme"
        >
          {theme === 'dark' ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#6366f1" />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </nav>
    </header>
  );
}
