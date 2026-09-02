'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, ArrowLeft, PlayCircle, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './page.module.css';

interface Question {
  id: string;
  topic: string;
  question: string;
  difficulty: 'Entry' | 'Mid' | 'Senior';
  answer: string;
}

function QuestionCard({ q, index, styles }: { q: any, index: number, styles: any }) {
  const [expanded, setExpanded] = useState(false);

  const diffColors: Record<string, { bg: string, text: string }> = {
    'Entry': { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    'Mid': { bg: 'rgba(56,189,248,0.15)', text: '#38bdf8' },
    'Senior': { bg: 'rgba(168,85,247,0.15)', text: '#c084fc' }
  };
  const diffStyles = diffColors[q.difficulty || 'Mid'] || diffColors['Mid'];

  return (
    <div className={styles.qCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {q.category || 'General'}
        </span>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: diffStyles.bg, color: diffStyles.text }}>
          {q.difficulty || 'Mid'} Level
        </span>
      </div>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem' }}>
        {index + 1}. {q.question}
      </h3>
      
      <button 
        onClick={() => setExpanded(!expanded)} 
        style={{ 
          background: 'transparent', 
          border: '1px solid rgba(255,255,255,0.1)', 
          color: 'var(--text-secondary)', 
          padding: '6px 12px', 
          borderRadius: '8px', 
          fontSize: '0.85rem', 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          marginBottom: expanded ? '1rem' : '0',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        {expanded ? 'Hide Answer' : 'View Ideal Answer'}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', animation: 'fadeIn 0.3s ease-out forwards' }}>
          <strong style={{ color: '#4ade80' }}>Ideal Model Answer:</strong> {q.answer}
        </div>
      )}
      
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href={`/interview/run?role=${encodeURIComponent(q.category || 'General')}`} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.82rem', gap: '6px' }}>
          <PlayCircle size={14} /> Practice This Topic
        </Link>
      </div>
    </div>
  );
}

export default function QuestionLibraryPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeDifficulty, setActiveDifficulty] = useState('All');
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/questions')
      .then(res => res.json())
      .then(data => {
        // Handle both paginated response { questions: [...] } and legacy array response
        setQuestions(Array.isArray(data) ? data : (data.questions || []));
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filtered = questions.filter(q => {
    const matchSearch = q.question.toLowerCase().includes(search.toLowerCase()) || (q.category || '').toLowerCase().includes(search.toLowerCase());
    const matchCategory = activeCategory === 'All' || (q.category || '') === activeCategory;
    const matchDifficulty = activeDifficulty === 'All' || (q.difficulty || 'Mid') === activeDifficulty;
    return matchSearch && matchCategory && matchDifficulty;
  });

  const uniqueCategories = ['All', ...Array.from(new Set(questions.map(q => q.category || 'General')))];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        <div className={styles.card}>
          <div className={styles.header}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99,102,241,0.12)', color: '#818cf8', padding: '4px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              <BookOpen size={16} /> AI Interview Question Library
            </div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800 }}>Top Technical Questions & Deep-Dives</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
              Explore real FAANG & top tech interview questions with ideal model answers.
            </p>
          </div>

          <input
            className={styles.searchBar}
            placeholder="🔍 Search questions by topic, keyword, or technology (e.g. Java, Redis, Indexing)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '8px', alignSelf: 'center' }}>Category:</span>
            {uniqueCategories.map((cat) => (
              <button
                key={cat}
                className="btn btn-secondary"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  background: activeCategory === cat ? 'rgba(99,102,241,0.2)' : undefined,
                  border: activeCategory === cat ? '1px solid rgba(99,102,241,0.5)' : undefined,
                  color: activeCategory === cat ? '#a5b4fc' : undefined,
                }}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '8px', alignSelf: 'center' }}>Difficulty:</span>
            {['All', 'Entry', 'Mid', 'Senior'].map((diff) => (
              <button
                key={diff}
                className="btn btn-secondary"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  background: activeDifficulty === diff ? 'rgba(99,102,241,0.2)' : undefined,
                  border: activeDifficulty === diff ? '1px solid rgba(99,102,241,0.5)' : undefined,
                  color: activeDifficulty === diff ? '#a5b4fc' : undefined,
                }}
                onClick={() => setActiveDifficulty(diff)}
              >
                {diff}
              </button>
            ))}
          </div>

          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading question library...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No questions found. Check back later!</div>
            ) : filtered.map((q, idx) => (
              <QuestionCard key={q._id} index={idx} q={q} styles={styles} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
