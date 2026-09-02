'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, GitCompare, Calendar } from 'lucide-react';
import { getInterviewHistory, InterviewSession } from '@/lib/stats';
import styles from './page.module.css';

export default function CompareSessionsPage() {
  const [history, setHistory] = useState<InterviewSession[]>([]);
  const [sessionAId, setSessionAId] = useState<string>('');
  const [sessionBId, setSessionBId] = useState<string>('');

  useEffect(() => {
    const list = getInterviewHistory();
    setHistory(list);
    if (list.length >= 2) {
      setSessionAId(list[0].id);
      setSessionBId(list[1].id);
    } else if (list.length === 1) {
      setSessionAId(list[0].id);
    }
  }, []);

  const sessionA = history.find(s => s.id === sessionAId);
  const sessionB = history.find(s => s.id === sessionBId);

  return (
    <div className={styles.comparePage}>
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/analytics" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            <ArrowLeft size={16} /> Back to Analytics
          </Link>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GitCompare size={32} color="#6366f1" /> Side-by-Side Session Comparison
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Compare your answers, score growth, and interview responses across different sessions.</p>
        </div>

        {/* Selectors */}
        <div className={styles.selectorGrid}>
          <div className={styles.selectBox}>
            <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>Select Session A (Baseline)</label>
            <select
              className={styles.selectInput}
              value={sessionAId}
              onChange={(e) => setSessionAId(e.target.value)}
            >
              <option value="">Choose Session A...</option>
              {history.map(s => (
                <option key={s.id} value={s.id}>
                  {new Date(s.date).toLocaleDateString()} — {s.role} ({s.overallScore != null ? `${s.overallScore}%` : 'No score'})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.selectBox}>
            <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>Select Session B (Recent)</label>
            <select
              className={styles.selectInput}
              value={sessionBId}
              onChange={(e) => setSessionBId(e.target.value)}
            >
              <option value="">Choose Session B...</option>
              {history.map(s => (
                <option key={s.id} value={s.id}>
                  {new Date(s.date).toLocaleDateString()} — {s.role} ({s.overallScore != null ? `${s.overallScore}%` : 'No score'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison Columns */}
        {sessionA && sessionB ? (
          <div className={styles.compareGrid}>
            {/* Session A */}
            <div className={styles.sessionColumn}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{sessionA.role}</h3>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                {new Date(sessionA.date).toLocaleString()}
              </div>

              <div className={styles.statBadge} style={{ color: sessionA.overallScore && sessionA.overallScore >= 70 ? '#4ade80' : '#fbbf24' }}>
                {sessionA.overallScore != null ? `${sessionA.overallScore}%` : 'Not Scored'}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Overall Score</div>

              <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>Transcript Highlights</h4>
              {sessionA.messages.slice(0, 6).map((m, idx) => (
                <div key={idx} className={`${styles.bubble} ${m.role === 'user' ? styles.userBubble : styles.aiBubble}`}>
                  <strong>{m.role === 'user' ? 'Candidate: ' : 'AI: '}</strong> {m.content}
                </div>
              ))}
            </div>

            {/* Session B */}
            <div className={styles.sessionColumn}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{sessionB.role}</h3>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                {new Date(sessionB.date).toLocaleString()}
              </div>

              <div className={styles.statBadge} style={{ color: sessionB.overallScore && sessionB.overallScore >= 70 ? '#4ade80' : '#fbbf24' }}>
                {sessionB.overallScore != null ? `${sessionB.overallScore}%` : 'Not Scored'}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Overall Score</div>

              <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>Transcript Highlights</h4>
              {sessionB.messages.slice(0, 6).map((m, idx) => (
                <div key={idx} className={`${styles.bubble} ${m.role === 'user' ? styles.userBubble : styles.aiBubble}`}>
                  <strong>{m.role === 'user' ? 'Candidate: ' : 'AI: '}</strong> {m.content}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontStyle: 'italic', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            Select two sessions above to view a side-by-side comparison of your performance.
          </div>
        )}
      </div>
    </div>
  );
}
