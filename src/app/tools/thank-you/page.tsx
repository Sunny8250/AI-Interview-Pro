'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Sparkles, Copy, ArrowLeft, Check } from 'lucide-react';
import styles from './page.module.css';

export default function ThankYouToolPage() {
  const [interviewerName, setInterviewerName] = useState('Sarah Vance');
  const [role, setRole] = useState('Senior Java Developer');
  const [company, setCompany] = useState('Google');
  const [keyTopics, setKeyTopics] = useState('Spring Boot Microservices, Redis Caching, and High Availability System Design');
  const [loading, setLoading] = useState(false);
  const [emailResult, setEmailResult] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-thank-you', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewerName, role, company, keyTopics }),
      });
      const data = await res.json();
      if (res.ok) setEmailResult(data.email);
    } catch {
      alert('Failed to generate thank-you email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        <div className={styles.card}>
          <div className={styles.header}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99,102,241,0.12)', color: '#818cf8', padding: '4px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              <Mail size={16} /> AI Recruiter Thank-You Note Generator
            </div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800 }}>Post-Interview Email Writer</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
              Generate a high-converting post-interview thank you email referencing your technical discussion.
            </p>
          </div>

          <div style={{ background: 'rgba(15,23,42,0.6)', padding: '1.75rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Interviewer / Recruiter Name</label>
                <input className={styles.input} value={interviewerName} onChange={(e) => setInterviewerName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Target Company</label>
                <input className={styles.input} value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Position Title</label>
              <input className={styles.input} value={role} onChange={(e) => setRole(e.target.value)} />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Key Topics Discussed in Interview</label>
              <textarea className={styles.input} rows={3} value={keyTopics} onChange={(e) => setKeyTopics(e.target.value)} />
            </div>

            <button className="btn btn-primary hover-lift" style={{ width: '100%', padding: '0.9rem', fontWeight: 700, gap: '8px' }} onClick={handleGenerate} disabled={loading}>
              <Sparkles size={18} />
              {loading ? 'Writing Email...' : 'Generate Recruiter Thank You Note'}
            </button>
          </div>

          {emailResult && (
            <div className="animate-fade-in" style={{ background: 'rgba(10,15,30,0.85)', border: '1px solid rgba(56,189,248,0.3)', padding: '1.5rem', borderRadius: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <strong style={{ color: '#38bdf8' }}>Generated Thank-You Email:</strong>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 12px', fontSize: '0.8rem', gap: '6px' }}
                  onClick={() => {
                    navigator.clipboard.writeText(emailResult);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Email'}
                </button>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: '#e0e7ff', fontSize: '0.92rem', lineHeight: 1.6, fontFamily: 'sans-serif' }}>
                {emailResult}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
