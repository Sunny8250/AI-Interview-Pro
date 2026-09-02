'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { UserPlus, Eye, EyeOff, ArrowRight } from 'lucide-react';
import styles from '../login/page.module.css';

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Password strength calculation
  const getPasswordStrength = () => {
    if (password.length === 0) return { label: '', color: 'transparent', pct: 0 };
    if (password.length < 6) return { label: 'Weak', color: '#f87171', pct: 33 };
    if (password.length < 10 || !/\d/.test(password)) return { label: 'Medium', color: '#fbbf24', pct: 66 };
    return { label: 'Strong', color: '#4ade80', pct: 100 };
  };

  const strength = getPasswordStrength();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const referralCode = new URLSearchParams(window.location.search).get('ref')?.trim();
      // 1. Create account via backend API
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, ...(referralCode ? { referralCode } : {}) }),
      });
      const regData = await regRes.json();

      if (!regRes.ok) {
        setError(regData.error || 'Failed to create account.');
        setLoading(false);
        return;
      }

      // 2. Redirect candidate to login page since verification is disabled
      router.push('/auth/login?registered=true');
    } catch {
      setError('An error occurred during registration.');
      setLoading(false);
    }
  };

  const handleSocialSignUp = (provider: 'google' | 'github' | 'linkedin') => {
    setSocialLoading(provider);
    setError('');
    signIn(provider, { callbackUrl: '/dashboard' });
  };

  return (
    <main className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '16px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', marginBottom: '1rem' }}>
            <UserPlus size={32} />
          </div>
          <h1>Create Your Account</h1>
          <p>Join thousands of candidates mastering AI mock interviews</p>
        </div>

        {/* Social SSO Buttons */}
        <div className={styles.socialGrid}>
          <button className={styles.socialBtn} onClick={() => handleSocialSignUp('google')} disabled={!!socialLoading}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#ea4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
              <path fill="#4285f4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
              <path fill="#fbbc05" d="M5.6 14.8c-.3-.8-.4-1.7-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
              <path fill="#34a853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/>
            </svg>
            <span>{socialLoading === 'google' ? 'Connecting Google...' : 'Sign up with Google'}</span>
          </button>

          <button className={styles.socialBtn} onClick={() => handleSocialSignUp('github')} disabled={!!socialLoading}>
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            <span>{socialLoading === 'github' ? 'Connecting GitHub...' : 'Sign up with GitHub'}</span>
          </button>

          <button className={styles.socialBtn} onClick={() => handleSocialSignUp('linkedin')} disabled={!!socialLoading}>
            <svg width="20" height="20" fill="#0a66c2" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
            </svg>
            <span>{socialLoading === 'linkedin' ? 'Connecting LinkedIn...' : 'Sign up with LinkedIn'}</span>
          </button>
        </div>

        <div className={styles.divider}>
          <span>Or sign up with email</span>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="name">Full Name</label>
            <input 
              id="name" 
              type="text" 
              className={styles.input} 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required 
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="email">Email Address</label>
            <input 
              id="email" 
              type="email" 
              className={styles.input} 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              required
              suppressHydrationWarning
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="password">Password</label>
            <div className={styles.passwordInputWrapper}>
              <input 
                id="password" 
                type={showPassword ? 'text' : 'password'} 
                className={styles.input} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required 
              />
              <button 
                type="button" 
                className={styles.eyeBtn}
                onClick={() => setShowPassword(prev => !prev)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Password Strength Meter */}
            {password.length > 0 && (
              <div style={{ marginTop: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: strength.color, marginBottom: '2px' }}>
                  <span>Password Strength:</span>
                  <span>{strength.label}</span>
                </div>
                <div style={{ height: '4px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${strength.pct}%`, background: strength.color, transition: 'all 0.3s ease' }} />
                </div>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className="btn btn-primary hover-lift" 
            disabled={loading}
            style={{ marginTop: '0.5rem', padding: '0.85rem', fontWeight: 700, gap: '8px' }}
          >
            {loading ? 'Creating Account...' : 'Get Started Free'}
            <ArrowRight size={18} />
          </button>
          
          <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color: '#818cf8', fontWeight: 700 }}>
              Sign In
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
