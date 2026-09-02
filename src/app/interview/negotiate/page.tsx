'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { DollarSign, Send, ArrowLeft } from 'lucide-react';
import styles from './page.module.css';

interface Message {
  role: 'user' | 'hr';
  content: string;
}

export default function NegotiatePage() {
  const [role, setRole] = useState('Senior Full Stack Developer');
  const [baseOffer, setBaseOffer] = useState('130,000');
  const [equity, setEquity] = useState('20,000');
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStart = () => {
    setStarted(true);
    setMessages([
      {
        role: 'hr',
        content: `Congratulations on passing our technical rounds! We are thrilled to extend an offer for the ${role} position. Our initial offer is a Base Salary of $${baseOffer}/year with $${equity} in Equity / RSUs over 4 years. How does this alignment sound to you?`
      }
    ]);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');

    const newMsgs: Message[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const res = await fetch('/api/negotiate-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          baseOffer,
          equity,
          messages: newMsgs,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get HR response');

      setMessages(prev => [...prev, { role: 'hr', content: data.message }]);
    } catch (_err: any) {
      setMessages(prev => [...prev, { role: 'hr', content: 'HR: Let me review your request with the compensation team and get back to you shortly.' }]);
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34,197,94,0.12)', color: '#4ade80', padding: '4px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              <DollarSign size={16} /> Mock HR Offer & Salary Negotiation Simulator
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Master Salary Counter-Offers</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
              Practice negotiating base salary, sign-on bonuses, equity, and remote perks with an AI Recruiter.
            </p>
          </div>

          {!started ? (
            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '1.75rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: '#f8fafc' }}>
                ⚙️ Configure Negotiation Scenario
              </h3>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Offered Position Title</label>
                <input className={styles.input} value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Base Salary Offer ($/yr)</label>
                  <input className={styles.input} value={baseOffer} onChange={(e) => setBaseOffer(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Equity / RSUs ($)</label>
                  <input className={styles.input} value={equity} onChange={(e) => setEquity(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>

              <button className="btn btn-primary hover-lift" style={{ width: '100%', padding: '0.9rem', fontWeight: 700 }} onClick={handleStart}>
                Start HR Negotiation
              </button>
            </div>
          ) : (
            <div>
              <div className={styles.chatContainer}>
                {messages.map((m, idx) => (
                  <div key={idx} className={`${styles.bubble} ${m.role === 'user' ? styles.userBubble : styles.hrBubble}`}>
                    <strong style={{ color: m.role === 'user' ? '#818cf8' : '#38bdf8', display: 'block', marginBottom: '4px', fontSize: '0.8rem' }}>
                      {m.role === 'user' ? 'Candidate' : 'Corporate HR Director'}
                    </strong>
                    {m.content}
                  </div>
                ))}
                {loading && (
                  <div className={`${styles.bubble} ${styles.hrBubble}`} style={{ opacity: 0.7 }}>
                    HR Director is typing response...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className={styles.inputArea}>
                <input
                  className={styles.input}
                  placeholder="Type your counter-proposal (e.g., 'Based on market data for Senior Devs in NYC, I am looking for $145,000 base...')"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  disabled={loading}
                />
                <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim() || loading} style={{ padding: '0.85rem 1.25rem' }}>
                  <Send size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
