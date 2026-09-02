'use client';

import Link from 'next/link';
import { Activity, Award, Clock, PlayCircle, Plus, LogOut, History, Star, Flame, BarChart3 } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { getStats, UserStats } from '@/lib/stats';
import styles from './page.module.css';

export default function Dashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    setStats(getStats());
  }, []);

  const averageScore = stats && stats.totalQuizQuestions > 0 
    ? Math.round((stats.totalQuizScore / stats.totalQuizQuestions) * 100) 
    : 0;

  return (
    <main className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
      <div className={styles.dashboardContainer}>
        <div className={styles.header}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800 }}>
              Welcome Back{session?.user?.name ? `, ${session.user.name}` : ''}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Ready to crush your next interview?
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/" className="btn btn-secondary">
              Home
            </Link>
            <button onClick={() => signOut()} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
              <LogOut size={18} style={{ marginRight: '8px' }} />
              Sign Out
            </button>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={`glass-panel ${styles.statCard}`}>
            <div className={styles.statIcon}>
              <Award size={28} />
            </div>
            <div className={styles.statInfo}>
              <h4>Average Score</h4>
              <p>{stats ? `${averageScore}%` : '...'}</p>
            </div>
          </div>
          
          <div className={`glass-panel ${styles.statCard}`}>
            <div className={styles.statIcon}>
              <Activity size={28} />
            </div>
            <div className={styles.statInfo}>
              <h4>Interviews Taken</h4>
              <p>{stats ? stats.interviewsTaken : '...'}</p>
            </div>
          </div>

          <div className={`glass-panel ${styles.statCard}`}>
            <div className={styles.statIcon}>
              <Clock size={28} />
            </div>
            <div className={styles.statInfo}>
              <h4>Hours Practiced</h4>
              <p>{stats ? `${(stats.hoursPracticed || 0).toFixed(1)}h` : '...'}</p>
            </div>
          </div>

          <div className={`glass-panel ${styles.statCard}`}>
            <div className={styles.statIcon} style={{ background: 'rgba(249, 115, 22, 0.12)', color: '#f97316' }}>
              <Flame size={28} />
            </div>
            <div className={styles.statInfo}>
              <h4>Practice Streak</h4>
              <p>{stats ? `${stats.currentStreak} Days 🔥` : '...'}</p>
            </div>
          </div>
        </div>

        {/* Target Real Interview Date Countdown Widget */}
        <div className="glass-panel" style={{ padding: '1.5rem 2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', border: '1px solid rgba(56, 189, 248, 0.3)', background: 'rgba(15, 23, 42, 0.6)' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📅 Real-World Interview Target Date
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
              Keep yourself accountable with a live practice countdown.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <input
              type="date"
              className={styles.statCard}
              style={{ padding: '8px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.15)', outline: 'none', fontFamily: 'inherit' }}
              onChange={(e) => {
                if (e.target.value) localStorage.setItem('target_interview_date', e.target.value);
              }}
              defaultValue={typeof window !== 'undefined' ? localStorage.getItem('target_interview_date') || '' : ''}
            />
            <Link href="/interview/setup" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.88rem' }}>
              Practice Now
            </Link>
          </div>
        </div>

        <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', fontWeight: 700 }}>
          Quick Actions
        </h2>
        
        <div className={styles.actionsGrid}>
          <div className={`glass-panel hover-lift ${styles.actionCard}`}>
            <div className={styles.actionHeader}>
              <div className={styles.statIcon} style={{ background: 'rgba(236, 72, 153, 0.1)', color: 'var(--secondary-color)' }}>
                <PlayCircle size={28} />
              </div>
              <h3 className={styles.actionTitle}>Start AI Quiz</h3>
            </div>
            <p className={styles.actionDesc}>
              Test your knowledge with multiple-choice and short-answer questions generated on-the-fly.
            </p>
            <Link href="/quiz/setup" className="btn btn-primary" style={{ marginTop: 'auto' }}>
              Begin Quiz
            </Link>
          </div>

          <div className={`glass-panel hover-lift ${styles.actionCard}`}>
            <div className={styles.actionHeader}>
              <div className={styles.statIcon}>
                <Plus size={28} />
              </div>
              <h3 className={styles.actionTitle}>Mock Interview</h3>
            </div>
            <p className={styles.actionDesc}>
              Engage in a realistic chat-based interview tailored to your target job role.
            </p>
            <Link href="/interview/setup" className="btn btn-primary" style={{ marginTop: 'auto' }}>
              Start Interview
            </Link>
          </div>

          <div className={`glass-panel hover-lift ${styles.actionCard}`}>
            <div className={styles.actionHeader}>
              <div className={styles.statIcon} style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                <History size={28} />
              </div>
              <h3 className={styles.actionTitle}>Session History</h3>
            </div>
            <p className={styles.actionDesc}>
              Review full transcripts, past performance scores, and detailed AI feedback reports.
            </p>
            <Link href="/history" className="btn btn-secondary" style={{ marginTop: 'auto' }}>
              View History
            </Link>
          </div>

          <div className={`glass-panel hover-lift ${styles.actionCard}`}>
            <div className={styles.actionHeader}>
              <div className={styles.statIcon} style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                <Star size={28} />
              </div>
              <h3 className={styles.actionTitle}>Bookmarked Questions</h3>
            </div>
            <p className={styles.actionDesc}>
              Access saved challenging questions, generate talking points, and study ideal model answers.
            </p>
            <Link href="/bookmarks" className="btn btn-secondary" style={{ marginTop: 'auto' }}>
              View Bookmarks
            </Link>
          </div>

          <div className={`glass-panel hover-lift ${styles.actionCard}`}>
            <div className={styles.actionHeader}>
              <div className={styles.statIcon} style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
                <BarChart3 size={28} />
              </div>
              <h3 className={styles.actionTitle}>Skill Analytics</h3>
            </div>
            <p className={styles.actionDesc}>
              Track score performance trends over time, compare sessions side-by-side, and target technical weaknesses.
            </p>
            <Link href="/analytics" className="btn btn-secondary" style={{ marginTop: 'auto' }}>
              View Analytics
            </Link>
          </div>
        </div>

        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 700, color: '#ef4444' }}>Danger Zone</h2>
          <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Delete Account</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Permanently delete your account and all associated data, including your interview history, stats, and personal information. This action cannot be undone.
            </p>
            <button
              className="btn btn-primary"
              style={{ background: '#ef4444', borderColor: '#ef4444', color: 'white' }}
              onClick={async () => {
                if (window.confirm('Are you absolutely sure you want to delete your account? This action cannot be undone.')) {
                  try {
                    const res = await fetch('/api/user-data/delete', { method: 'DELETE' });
                    if (res.ok) {
                      signOut({ callbackUrl: '/' });
                    } else {
                      alert('Failed to delete account');
                    }
                  } catch (e) {
                    console.error(e);
                    alert('Failed to delete account');
                  }
                }
              }}
            >
              Delete My Account
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}
