'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { saveQuizScore } from '@/lib/stats';
import styles from './page.module.css';

interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

const CodeBlock = ({ _node, inline, className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div style={{ position: 'relative', marginTop: '1rem', marginBottom: '1rem' }} onClick={(e) => e.stopPropagation()}>
        <button 
          onClick={handleCopy}
          style={{ position: 'absolute', top: '8px', right: '8px', padding: '6px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#fff', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Copy code"
        >
          {copied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
        </button>
        <SyntaxHighlighter
          style={vscDarkPlus as any}
          language={match[1]}
          PreTag="div"
          customStyle={{ margin: 0, borderRadius: '8px', fontSize: '0.9rem', padding: '1.5rem 1rem 1rem 1rem' }}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }
  return (
    <code className={className} style={{ background: 'rgba(0,0,0,0.4)', padding: '0.2em 0.4em', borderRadius: '4px', color: '#a78bfa' }} {...props}>
      {children}
    </code>
  );
};

function QuizContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  
  const topic = searchParams.get('topic');
  const difficulty = searchParams.get('difficulty');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const fetchInitiated = useRef(false);

  useEffect(() => {
    if (!topic || !difficulty) {
      router.push('/quiz/setup');
      return;
    }

    if (fetchInitiated.current) return;
    fetchInitiated.current = true;

    const fetchQuiz = async () => {
      try {
        const cacheKey = `cached_quiz_${topic}_${difficulty}`;
        const cached = sessionStorage.getItem(cacheKey);
        
        if (cached) {
          const parsedCache = JSON.parse(cached);
          setQuestions(parsedCache.questions);
          setLoading(false);
          return;
        }

        const userEmail = session?.user?.email || '';
        const res = await fetch('/api/generate-quiz', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(userEmail ? { 'x-user-email': userEmail } : {}),
          },
          body: JSON.stringify({ topic, difficulty }),
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          if (data.code === 'OUT_OF_CREDITS' || res.status === 402) {
            window.dispatchEvent(new CustomEvent('open-pricing-modal'));
          }
          throw new Error(data.error || 'Failed to fetch quiz');
        }

        if (data.remainingCredits !== undefined) {
          window.dispatchEvent(new CustomEvent('user-credits-updated', { detail: { remainingCredits: data.remainingCredits } }));
        }
        
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        setQuestions(data.questions);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [topic, difficulty, router, session?.user?.email]);

  const handleSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);

    if (index === questions[currentIndex].correctAnswerIndex) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setQuizFinished(true);
      saveQuizScore(score + (selectedOption === questions[currentIndex].correctAnswerIndex ? 1 : 0), questions.length, 5); // Assumes 5 mins for a quiz
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <h2>AI is generating your custom quiz...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Topic: {topic} | Level: {difficulty}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.loadingState}>
        <XCircle size={48} color="var(--error)" />
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => router.push('/quiz/setup')}>
          Try Again
        </button>
      </div>
    );
  }

  if (quizFinished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className={`glass-panel animate-fade-in ${styles.resultsCard}`}>
        <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Quiz Complete!</h2>
        
        <div 
          className={styles.scoreCircle} 
          style={{ '--percentage': `${percentage}%` } as React.CSSProperties}
        >
          <span className={styles.scoreText}>{percentage}%</span>
        </div>
        
        <p style={{ fontSize: '1.25rem', marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          You scored {score} out of {questions.length} on {topic}.
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/quiz/setup')}>
            <RotateCcw size={18} style={{ marginRight: '0.5rem' }} />
            New Quiz
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className={`glass-panel animate-fade-in ${styles.questionCard}`}>
      <div className={styles.header}>
        <span className={styles.progressText}>
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
          Score: {score}
        </span>
      </div>

      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill} 
          style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
        />
      </div>

      <div className={styles.questionText}>
        <ReactMarkdown components={{ code: CodeBlock }}>
          {currentQ.question}
        </ReactMarkdown>
      </div>

      <div className={styles.optionsGrid}>
        {currentQ.options.map((option, idx) => {
          let btnClass = styles.optionBtn;
          if (isAnswered) {
            if (idx === currentQ.correctAnswerIndex) btnClass += ` ${styles.correct}`;
            else if (idx === selectedOption) btnClass += ` ${styles.wrong}`;
          } else if (idx === selectedOption) {
            btnClass += ` ${styles.selected}`;
          }

          const letters = ['A', 'B', 'C', 'D', 'E'];

          return (
            <button
              key={idx}
              className={btnClass}
              onClick={() => handleSelect(idx)}
              disabled={isAnswered}
            >
              <div className={styles.optionLetter}>{letters[idx]}</div>
              <div className={styles.optionText}>
                <ReactMarkdown components={{ code: CodeBlock }}>
                  {option}
                </ReactMarkdown>
              </div>
              
              {isAnswered && idx === currentQ.correctAnswerIndex && <CheckCircle2 color="var(--success)" size={24} style={{ flexShrink: 0 }} />}
              {isAnswered && idx === selectedOption && idx !== currentQ.correctAnswerIndex && <XCircle color="var(--error)" size={24} style={{ flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div className={`animate-fade-in ${styles.explanation}`}>
          <h4 style={{ color: selectedOption === currentQ.correctAnswerIndex ? 'var(--success)' : 'var(--error)' }}>
            {selectedOption === currentQ.correctAnswerIndex ? 'Correct!' : 'Incorrect'}
          </h4>
          <ReactMarkdown components={{ code: CodeBlock }}>
            {currentQ.explanation}
          </ReactMarkdown>
        </div>
      )}

      {isAnswered && (
        <div className={styles.footer}>
          <button className="btn btn-primary animate-fade-in" onClick={handleNext}>
            {currentIndex < questions.length - 1 ? 'Next Question' : 'View Results'}
            <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function QuizRun() {
  return (
    <main className="container" style={{ paddingBottom: '4rem' }}>
      <div className={styles.quizContainer}>
        <Suspense fallback={<div className={styles.loadingState}><div className={styles.spinner}></div></div>}>
          <QuizContent />
        </Suspense>
      </div>
    </main>
  );
}
