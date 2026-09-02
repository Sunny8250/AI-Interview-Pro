'use client';

import { use } from 'react';
import Link from 'next/link';
import { Award, Download, Share2, ArrowLeft } from 'lucide-react';
import styles from './page.module.css';

export default function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);

  return (
    <div className={styles.page}>
      <div style={{ maxWidth: '800px', width: '100%' }}>
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        <div className={styles.certCard}>
          <div className={styles.seal}>
            <Award size={36} color="#fff" />
          </div>

          <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#fbbf24', fontWeight: 800, marginBottom: '0.5rem' }}>
            Official Certificate of Technical Competency
          </div>

          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f8fafc', marginBottom: '1.5rem' }}>
            AI Verified Skill Certification
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: '0 auto 2rem', maxWidth: '550px', lineHeight: 1.6 }}>
            This certifies that the candidate has successfully completed a rigorous multi-tier AI Technical Mock Interview evaluation for the position of:
          </p>

          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#818cf8', marginBottom: '1.5rem' }}>
            Java Developer & Software Engineer
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', margin: '2rem 0', padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verified Score</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#4ade80' }}>92%</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '2rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credential ID</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px', fontFamily: 'monospace' }}>
                CERT-{resolvedParams.id.substring(0, 8).toUpperCase()}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
            <button className="btn btn-primary" onClick={() => window.print()} style={{ padding: '0.75rem 1.5rem', gap: '8px' }}>
              <Download size={18} /> Print / Save Certificate
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('Certificate Link copied to clipboard!');
              }}
              style={{ padding: '0.75rem 1.5rem', gap: '8px' }}
            >
              <Share2 size={18} /> Share Credential
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
