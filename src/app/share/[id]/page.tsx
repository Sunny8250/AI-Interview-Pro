'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Share2, Calendar } from 'lucide-react';
import styles from './page.module.css';

interface PublicReport {
  role: string;
  experience: string;
  createdAt: string;
  expiresAt: string;
  report: {
    overallScore: number;
    communicationScore: number | null;
    technicalScore: number | null;
    confidenceScore: number | null;
    summary: string;
    strengths: string[];
    areasToImprove: string[];
  };
}

export default function ShareReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [publicReport, setPublicReport] = useState<PublicReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/share/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Report not found');
        setPublicReport(data);
      })
      .catch((fetchError: Error) => setError(fetchError.message));
  }, [id]);

  if (error || !publicReport) {
    return (
      <div className={styles.sharePage}>
        <div className={styles.container} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <h2>{error ? 'Report Not Found' : 'Loading Report…'}</h2>
          {error && <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 2rem' }}>{error}</p>}
          {error && <Link href="/" className="btn btn-primary">Back to AI Interview Pro</Link>}
        </div>
      </div>
    );
  }

  const { report } = publicReport;
  return (
    <div className={styles.sharePage}>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99,102,241,0.12)', color: '#818cf8', padding: '4px 12px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              <Share2 size={14} /> Shared Interview Performance Report
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>{publicReport.role} Interview</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
              {publicReport.experience} · Completed on {new Date(publicReport.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '2rem', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: report.overallScore >= 75 ? '#4ade80' : '#fbbf24' }}>{report.overallScore}%</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Overall Interview Score</div>
          </div>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2>Summary</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.6 }}>{report.summary}</p>
          </section>
          <section style={{ marginBottom: '1.5rem' }}>
            <h2>Strengths</h2>
            <ul>{report.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section>
            <h2>Areas to improve</h2>
            <ul>{report.areasToImprove.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>
      </div>
    </div>
  );
}
