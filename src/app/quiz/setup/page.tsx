'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from './page.module.css';
import { BrainCircuit } from 'lucide-react';

export default function QuizSetup() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [loading, setLoading] = useState(false);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [userTier, setUserTier] = useState<'free' | 'pro'>('free');
  const { data: session } = useSession();

  useEffect(() => {
    const userEmail = session?.user?.email || '';
    const headers: Record<string, string> = userEmail ? { 'x-user-email': userEmail } : {};
    fetch('/api/user-credits', { headers })
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.aiCredits === 'number') {
          setUserCredits(data.aiCredits);
          setUserTier(data.tier);
        }
      })
      .catch(() => {});
  }, [session?.user?.email]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    // Pre-flight Credit Check (1.5 Credits for AI Quiz)
    if (userTier !== 'pro' && userCredits !== null && userCredits < 1.5) {
      window.dispatchEvent(new CustomEvent('open-pricing-modal'));
      alert(`⚠️ Insufficient AI credits (1.5 Credits required for AI Quiz Generation). You currently have ${userCredits.toFixed(1)} Credits. Please upgrade or top up!`);
      return;
    }
    
    setLoading(true);
    router.push(`/quiz/run?topic=${encodeURIComponent(topic)}&difficulty=${difficulty}`);
  };

  return (
    <main className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
      <div className={`glass-panel ${styles.setupContainer}`}>
        <div className={styles.setupHeader}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--primary-color)' }}>
            <BrainCircuit size={48} />
          </div>
          <h1>Configure Your Quiz</h1>
          <p>Let AI tailor the perfect assessment for you.</p>
        </div>

        <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="topic">Topic or Job Role</label>
            <input 
              id="topic"
              type="text" 
              className={styles.input} 
              placeholder="e.g. React Developer, Data Structures, Marketing Manager"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="difficulty">Difficulty Level</label>
            <select 
              id="difficulty"
              className={`${styles.input} ${styles.select}`}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Expert">Expert</option>
            </select>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary hover-lift" 
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate AI Quiz'}
          </button>
        </form>
      </div>
    </main>
  );
}
