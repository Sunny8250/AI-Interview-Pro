'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCw, Sparkles, ChevronRight } from 'lucide-react';
import { getBookmarkedQuestions, BookmarkedQuestion } from '@/lib/stats';
import styles from './page.module.css';

export default function FlashcardsPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkedQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string>('');
  const [loadingAnswer, setLoadingAnswer] = useState(false);

  useEffect(() => {
    setBookmarks(getBookmarkedQuestions());
  }, []);

  const current = bookmarks[currentIndex];

  const fetchModelAnswer = async () => {
    if (!current || aiAnswer) return;
    setLoadingAnswer(true);
    try {
      const res = await fetch('/api/generate-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: current.question, role: current.role, type: 'model' }),
      });
      const data = await res.json();
      setAiAnswer(data.result || 'No model answer generated.');
    } catch {
      setAiAnswer('Failed to fetch model answer.');
    } finally {
      setLoadingAnswer(false);
    }
  };

  const handleFlip = () => {
    if (!isFlipped && !aiAnswer) {
      fetchModelAnswer();
    }
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    setIsFlipped(false);
    setAiAnswer('');
    setCurrentIndex((prev) => (prev + 1) % bookmarks.length);
  };

  if (bookmarks.length === 0) {
    return (
      <div className={styles.flashcardsPage}>
        <div className={styles.container} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <h1 style={{ marginBottom: '1rem' }}>No Flashcards Available</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Bookmark difficult questions during your mock interviews to automatically generate interactive practice flashcards!
          </p>
          <Link href="/bookmarks" className="btn btn-primary">Go to Saved Bookmarks</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.flashcardsPage}>
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/bookmarks" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            <ArrowLeft size={16} /> Back to Bookmarks Bank
          </Link>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={28} color="#818cf8" /> Interactive Practice Deck
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Card {currentIndex + 1} of {bookmarks.length} · Tap card to reveal ideal AI Model Answer
          </p>
        </div>

        {/* Card */}
        <div className={styles.cardContainer}>
          <div className={styles.flashcard} onClick={handleFlip}>
            <div>
              <span className={styles.cardTag}>
                {isFlipped ? '✨ Ideal Model Answer' : `❓ ${current.role} Question`}
              </span>
              <div className={styles.cardContent}>
                {!isFlipped ? (
                  current.question
                ) : loadingAnswer ? (
                  <span style={{ color: '#38bdf8', fontStyle: 'italic' }}>Generating ideal model answer...</span>
                ) : (
                  aiAnswer
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <span>Click to {isFlipped ? 'see Question' : 'reveal Model Answer'}</span>
              <RotateCw size={16} />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <button className="btn btn-secondary" onClick={handleFlip} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCw size={16} /> Flip Card
          </button>
          <button className="btn btn-primary" onClick={handleNext} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            Next Question <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
