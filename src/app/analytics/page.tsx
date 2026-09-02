'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TrendingUp, AlertTriangle, Award, ArrowLeft, BarChart3 } from 'lucide-react';
import { getInterviewHistory, getStats, InterviewSession, UserStats } from '@/lib/stats';
import styles from './page.module.css';

export default function AnalyticsPage() {
  const [history, setHistory] = useState<InterviewSession[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    setHistory(getInterviewHistory());
    setStats(getStats());
  }, []);

  const scoredSessions = history.filter(s => s.overallScore != null);
  const avgScore = scoredSessions.length > 0
    ? Math.round(scoredSessions.reduce((a, b) => a + (b.overallScore || 0), 0) / scoredSessions.length)
    : 0;

  return (
    <div className={styles.analyticsPage}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>
            <h1>Skill Analytics & Progress</h1>
          </div>
          <Link href="/history/compare" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <BarChart3 size={18} /> Compare Sessions Side-by-Side
          </Link>
        </div>

        {/* Quick Stats Grid */}
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <Award size={20} color="#4ade80" /> Overall Average Score
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#4ade80' }}>
              {avgScore > 0 ? `${avgScore}%` : 'N/A'}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
              Across {scoredSessions.length} completed interviews
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <TrendingUp size={20} color="#38bdf8" /> Practice Volume
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#38bdf8' }}>
              {stats ? `${stats.hoursPracticed.toFixed(1)}h` : '0h'}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
              {stats?.interviewsTaken || 0} Total Sessions Taken
            </div>
          </div>
        </div>

        {/* Score Trend Bar Chart */}
        <div className={styles.card} style={{ marginBottom: '2.5rem' }}>
          <div className={styles.cardTitle}>
            <TrendingUp size={20} color="#6366f1" /> Historical Score Performance Trend
          </div>
          {scoredSessions.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>
              No scored interview sessions recorded yet. Complete mock interviews to view your historical performance graph!
            </p>
          ) : (
            <>
              <div className={styles.trendLine}>
                {scoredSessions.slice(-10).map((s, idx) => (
                  <div
                    key={s.id || idx}
                    className={styles.trendBar}
                    style={{ height: `${s.overallScore}%` }}
                    data-score={`${s.overallScore}%`}
                    title={`${s.role} (${s.overallScore}%)`}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.5rem' }}>
                <span>Earliest Session</span>
                <span>Latest Session</span>
              </div>
            </>
          )}
        </div>

        {/* Common Focus Areas */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <AlertTriangle size={20} color="#fbbf24" /> Priority Areas & Recommendations
          </div>
          <div className={styles.weaknessList}>
            <div className={styles.weaknessItem}>
              <span>⚡ System Concurrency & Thread Safety</span>
              <span style={{ fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>Needs Practice</span>
            </div>
            <div className={styles.weaknessItem}>
              <span>🧠 Big-O Complexity Justifications</span>
              <span style={{ fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>Needs Practice</span>
            </div>
            <div className={styles.weaknessItem}>
              <span>🗣️ STAR Behavioral Action Clarity</span>
              <span style={{ fontSize: '0.78rem', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: '6px' }}>Moderate</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
