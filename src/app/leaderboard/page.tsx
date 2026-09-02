'use client';

import Link from 'next/link';
import { Trophy, ArrowLeft } from 'lucide-react';
import styles from './page.module.css';

export default function LeaderboardPage() {
  const leaderData = [
    { rank: 1, name: 'Alex Rivera', role: 'Java Microservices', score: 98, streak: '14 Days 🔥', badge: '🥇 Master' },
    { rank: 2, name: 'Priya Sharma', role: 'Full Stack Engineer', score: 96, streak: '11 Days 🔥', badge: '🥈 Expert' },
    { rank: 3, name: 'David Chen', role: 'System Design Architect', score: 94, streak: '9 Days 🔥', badge: '🥉 Senior' },
    { rank: 4, name: 'Sarah Jenkins', role: 'Frontend React Dev', score: 91, streak: '7 Days 🔥', badge: '⭐ Pro' },
    { rank: 5, name: 'You (Current User)', role: 'Java Developer', score: 88, streak: '5 Days 🔥', badge: '🚀 Rising Star' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        <div className={styles.card}>
          <div className={styles.header}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245,158,11,0.12)', color: '#fbbf24', padding: '4px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              <Trophy size={16} /> Community Leaderboard & Practice Ranks
            </div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800 }}>Weekly Candidate Rankings</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
              Top candidates preparing for technical interviews this week.
            </p>
          </div>

          <div>
            {leaderData.map((user) => (
              <div key={user.rank} className={styles.row} style={{ background: user.name.includes('You') ? 'rgba(99,102,241,0.15)' : undefined, border: user.name.includes('You') ? '1px solid rgba(99,102,241,0.4)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className={`${styles.rankBadge} ${user.rank === 1 ? styles.rank1 : user.rank === 2 ? styles.rank2 : user.rank === 3 ? styles.rank3 : ''}`}>
                    {user.rank}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: user.name.includes('You') ? '#a5b4fc' : '#f8fafc' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {user.role}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#f97316', fontWeight: 700 }}>
                    {user.streak}
                  </span>
                  <span style={{ background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600, color: '#e0e7ff' }}>
                    {user.badge}
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: user.score >= 90 ? '#4ade80' : '#fbbf24', minWidth: '55px', textAlign: 'right' }}>
                    {user.score}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
