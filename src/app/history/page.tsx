'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Trash2, ArrowRight, History, Calendar, Clock, MessageSquare, Plus } from 'lucide-react';
import { getInterviewHistory, deleteInterviewSession, InterviewSession } from '@/lib/stats';
import styles from './page.module.css';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSessions(getInterviewHistory());
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this session from your history?')) {
      deleteInterviewSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    }
  };

  const filteredSessions = sessions.filter(session => {
    const q = searchQuery.toLowerCase();
    return (
      session.role.toLowerCase().includes(q) ||
      session.experience.toLowerCase().includes(q) ||
      (session.overallScore && session.overallScore.toString().includes(q))
    );
  });

  const getScoreBadgeClass = (score: number | null) => {
    if (score === null) return styles.none;
    if (score >= 75) return styles.high;
    if (score >= 50) return styles.mid;
    return styles.low;
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1>Interview History</h1>
            <p>Review past sessions, scores, and complete transcripts</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href="/interview/setup" className="btn btn-primary" style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
              <Plus size={18} /> New Session
            </Link>
            <Link href="/dashboard" className="btn btn-secondary">
              Dashboard
            </Link>
          </div>
        </div>

        {sessions.length > 0 && (
          <div className={styles.searchBar}>
            <Search className={styles.searchIcon} size={18} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by role, level, or score..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        {filteredSessions.length === 0 ? (
          <div className={styles.empty}>
            <History size={48} />
            <h3>{sessions.length === 0 ? 'No Interview History Yet' : 'No Matching Sessions'}</h3>
            <p style={{ maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
              {sessions.length === 0
                ? 'Complete your first mock interview to track your performance and review transcripts here.'
                : 'Try searching for a different role or keyword.'}
            </p>
            {sessions.length === 0 && (
              <Link href="/interview/setup" className="btn btn-primary">
                Start First Interview
              </Link>
            )}
          </div>
        ) : (
          <div className={styles.sessionList}>
            {filteredSessions.map(session => (
              <Link key={session.id} href={`/history/${session.id}`} className={styles.sessionCard}>
                <div className={`${styles.scoreBadge} ${getScoreBadgeClass(session.overallScore)}`}>
                  {session.overallScore !== null ? session.overallScore : '--'}
                </div>

                <div className={styles.sessionInfo}>
                  <div className={styles.sessionRole}>
                    {session.role} {session.experience ? `(${session.experience})` : ''}
                  </div>
                  <div className={styles.sessionMeta}>
                    <span><Calendar size={14} style={{ marginRight: '4px', inlineSize: '14px' }} /> {formatDate(session.date)}</span>
                    <span><Clock size={14} style={{ marginRight: '4px', inlineSize: '14px' }} /> {Math.ceil(session.durationMinutes)} mins</span>
                    <span><MessageSquare size={14} style={{ marginRight: '4px', inlineSize: '14px' }} /> {session.messageCount} answers</span>
                  </div>
                </div>

                <div className={styles.sessionActions}>
                  <button
                    className={`${styles.iconBtn} ${styles.danger}`}
                    onClick={(e) => handleDelete(e, session.id)}
                    title="Delete Session"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className={styles.iconBtn} title="View Transcript">
                    <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
