'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, Award, RotateCcw } from 'lucide-react';
import { getSessionById, InterviewSession } from '@/lib/stats';
import styles from '../../interview/run/page.module.css'; // Reusing chat styling for transcript replay

export default function SessionReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [session, setSession] = useState<InterviewSession | null>(null);

  useEffect(() => {
    const data = getSessionById(resolvedParams.id);
    if (!data) {
      router.push('/history');
      return;
    }
    setSession(data);
  }, [resolvedParams.id, router]);

  if (!session) return null;

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const reanalyzeFeedback = () => {
    sessionStorage.setItem(
      'interviewSession',
      JSON.stringify({
        messages: session.messages,
        role: session.role,
        experience: session.experience,
        sessionId: session.id,
      })
    );
    const p = new URLSearchParams();
    if (session.role) p.set('role', session.role);
    if (session.experience) p.set('experience', session.experience);
    router.push(`/interview/feedback?${p.toString()}`);
  };

  return (
    <main className="animate-fade-in" style={{ padding: '0 1rem 4rem 1rem' }}>
      <div className={styles.chatContainer}>
        <div className={styles.chatHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/history" className="btn btn-secondary" style={{ padding: '8px 12px' }}>
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>{session.role} Transcript</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', gap: '0.75rem', marginTop: '2px' }}>
                <span><Calendar size={13} style={{ marginRight: '3px' }} /> {formatDate(session.date)}</span>
                <span><Clock size={13} style={{ marginRight: '3px' }} /> {Math.ceil(session.durationMinutes)} mins</span>
                {session.overallScore !== null && (
                  <span style={{ color: '#4ade80', fontWeight: 600 }}>
                    <Award size={13} style={{ marginRight: '3px' }} /> {session.overallScore}/100 Score
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <button onClick={reanalyzeFeedback} className="btn btn-primary" style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
            <RotateCcw size={16} /> View AI Report
          </button>
        </div>

        <div className={styles.chatHistory} style={{ paddingBottom: '2rem' }}>
          {session.messages.map((msg, idx) => (
            <div key={idx} className={`${styles.messageWrapper} ${styles[msg.role]}`}>
              <div className={`${styles.avatar} ${styles[msg.role]}`}>
                {msg.role === 'ai' ? 'AI' : 'YOU'}
              </div>
              <div className={styles.messageBubble}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
