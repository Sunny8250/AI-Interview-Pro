'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Star, Trash2, Calendar, Sparkles, Lightbulb, Plus } from 'lucide-react';
import { getBookmarkedQuestions, deleteBookmark, BookmarkedQuestion } from '@/lib/stats';
import styles from './page.module.css';
import runStyles from '../interview/run/page.module.css';

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkedQuestion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeHintMap, setActiveHintMap] = useState<{ [id: string]: { type: 'hint' | 'model'; text: string; loading: boolean } }>({});

  useEffect(() => {
    setBookmarks(getBookmarkedQuestions());
  }, []);

  const handleDelete = (id: string) => {
    deleteBookmark(id);
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const handleFetchHint = async (item: BookmarkedQuestion, type: 'hint' | 'model') => {
    const current = activeHintMap[item.id];
    if (current && current.type === type && !current.loading) {
      // Toggle off
      setActiveHintMap(prev => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
      return;
    }

    setActiveHintMap(prev => ({
      ...prev,
      [item.id]: { type, text: 'Generating answer...', loading: true },
    }));

    try {
      const res = await fetch('/api/generate-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: item.question, role: item.role, type }),
      });
      const data = await res.json();
      setActiveHintMap(prev => ({
        ...prev,
        [item.id]: { type, text: data.result || 'No content generated.', loading: false },
      }));
    } catch {
      setActiveHintMap(prev => ({
        ...prev,
        [item.id]: { type, text: 'Failed to generate answer.', loading: false },
      }));
    }
  };

  const filteredBookmarks = bookmarks.filter(b => {
    const q = searchQuery.toLowerCase();
    return b.question.toLowerCase().includes(q) || b.role.toLowerCase().includes(q);
  });

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1><Star fill="#fbbf24" color="#fbbf24" size={28} /> Bookmarked Questions</h1>
            <p>Review difficult questions you saved during mock interview sessions</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="/bookmarks/flashcards" className="btn btn-secondary" style={{ gap: '6px', display: 'flex', alignItems: 'center', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8' }}>
              <Sparkles size={18} /> Practice Flashcard Deck
            </Link>
            <Link href="/interview/setup" className="btn btn-primary" style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
              <Plus size={18} /> New Session
            </Link>
            <Link href="/dashboard" className="btn btn-secondary">
              Dashboard
            </Link>
          </div>
        </div>

        {bookmarks.length > 0 && (
          <div className={styles.searchBar}>
            <Search className={styles.searchIcon} size={18} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search bookmarked questions or roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        {filteredBookmarks.length === 0 ? (
          <div className={styles.empty}>
            <Star size={48} />
            <h3>{bookmarks.length === 0 ? 'No Bookmarked Questions Yet' : 'No Matching Questions'}</h3>
            <p style={{ maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
              {bookmarks.length === 0
                ? 'During a mock interview, click the "Bookmark Question" button on any difficult AI question to save it here for revision.'
                : 'Try searching for a different keyword.'}
            </p>
            {bookmarks.length === 0 && (
              <Link href="/interview/setup" className="btn btn-primary">
                Start Mock Interview
              </Link>
            )}
          </div>
        ) : (
          <div className={styles.bookmarkList}>
            {filteredBookmarks.map(item => (
              <div key={item.id} className={styles.bookmarkCard}>
                <div className={styles.bookmarkTop}>
                  <div className={styles.bookmarkQuestion}>"{item.question}"</div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                    title="Remove Bookmark"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className={styles.bookmarkMeta}>
                  <span className={styles.roleTag}>{item.role}</span>
                  <span><Calendar size={13} style={{ marginRight: '4px', inlineSize: '13px' }} /> Saved {formatDate(item.date)}</span>
                </div>

                <div className={styles.cardActions}>
                  <button
                    className={`${runStyles.hintBtn} ${activeHintMap[item.id]?.type === 'hint' ? runStyles.activeHint : ''}`}
                    onClick={() => handleFetchHint(item, 'hint')}
                    disabled={activeHintMap[item.id]?.loading}
                  >
                    <Lightbulb size={13} />
                    {activeHintMap[item.id]?.type === 'hint' && activeHintMap[item.id]?.loading ? 'Loading...' : 'Key Talking Points'}
                  </button>
                  <button
                    className={`${runStyles.hintBtn} ${activeHintMap[item.id]?.type === 'model' ? runStyles.activeModel : ''}`}
                    onClick={() => handleFetchHint(item, 'model')}
                    disabled={activeHintMap[item.id]?.loading}
                  >
                    <Sparkles size={13} />
                    {activeHintMap[item.id]?.type === 'model' && activeHintMap[item.id]?.loading ? 'Loading...' : 'Study Model Answer'}
                  </button>
                </div>

                {/* Answer Callout Box */}
                {activeHintMap[item.id] && (
                  <div className={`${runStyles.hintBox} ${activeHintMap[item.id].type === 'hint' ? runStyles.hintType : runStyles.modelType}`}>
                    <div className={runStyles.hintHeader}>
                      {activeHintMap[item.id].type === 'hint' ? <Lightbulb size={14} /> : <Sparkles size={14} />}
                      {activeHintMap[item.id].type === 'hint' ? 'Key Concepts To Mention' : 'Ideal Model Answer'}
                    </div>
                    <div>{activeHintMap[item.id].text}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
