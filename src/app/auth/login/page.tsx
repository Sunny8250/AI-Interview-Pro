'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import styles from './page.module.css';

export default function Login() {
  const _router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError('Invalid login credentials. Please enter a valid email and password.');
        setLoading(false);
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setError('Connection failed. Please try again.');
      setLoading(false);
    }
  };

  const handleSocialSignIn = (provider: 'google' | 'github' | 'linkedin') => {
    setSocialLoading(provider);
    setError('');
    signIn(provider, { callbackUrl: '/dashboard' });
  };

  return (
    <main className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '16px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', marginBottom: '1rem' }}>
            <Lock size={32} />
          </div>
          <h1>Welcome Back</h1>
          <p>Sign in with your favorite account or email</p>
        </div>

        {/* Social SSO Buttons */}
        <div className={styles.socialGrid}>
          <button className={styles.socialBtn} onClick={() => handleSocialSignIn('google')} disabled={!!socialLoading}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#ea4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
              <path fill="#4285f4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
              <path fill="#fbbc05" d="M5.6 14.8c-.3-.8-.4-1.7-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
              <path fill="#34a853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/>
            </svg>
            <span>{socialLoading === 'google' ? 'Connecting Google...' : 'Continue with Google'}</span>
          </button>

          <button className={styles.socialBtn} onClick={() => handleSocialSignIn('github')} disabled={!!socialLoading}>
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            <span>{socialLoading === 'github' ? 'Connecting GitHub...' : 'Continue with GitHub'}</span>
          </button>

          <button className={styles.socialBtn} onClick={() => handleSocialSignIn('linkedin')} disabled={!!socialLoading}>
            <svg width="20" height="20" fill="#0a66c2" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
            </svg>
            <span>{socialLoading === 'linkedin' ? 'Connecting LinkedIn...' : 'Continue with LinkedIn'}</span>
          </button>
        </div>

        <div className={styles.divider}>
          <span>Or sign in with email</span>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="email">Email Address</label>
            <input 
              id="email" 
              type="email" 
              className={styles.input} 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="candidate@example.com"
              required
              suppressHydrationWarning
            />
          </div>

          <div className={styles.inputGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className={styles.label} htmlFor="password">Password</label>
              <a href="#" onClick={(e) => { e.preventDefault(); alert('Demo password reset link sent!'); }} style={{ fontSize: '0.8rem', color: '#818cf8' }}>
                Forgot?
              </a>
            </div>
            <div className={styles.passwordInputWrapper}>
              <input 
                id="password" 
                type={showPassword ? 'text' : 'password'} 
                className={styles.input} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ accentColor: '#6366f1', cursor: 'pointer' }}
            />
            <label htmlFor="remember" style={{ cursor: 'pointer' }}>Keep me logged in on this browser</label>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary hover-lift" 
            disabled={loading}
            style={{ marginTop: '0.5rem', padding: '0.85rem', fontWeight: 700, gap: '8px' }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight size={18} />
          </button>
          
          <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            New to AI Interview Pro?{' '}
            <Link href="/auth/signup" style={{ color: '#818cf8', fontWeight: 700 }}>
              Create an Account
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
