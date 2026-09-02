import Link from 'next/link';
import { Brain, MessageSquare, Target, Zap } from 'lucide-react';
import styles from './page.module.css';

export default function Home() {
  return (
    <main>
      <div className={styles.hero}>
        <div className={styles.glowBlob}></div>
        <div className={`container animate-fade-in`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 className={styles.title}>
            Master Your Next Interview with <span className="gradient-text">AI Precision</span>
          </h1>
          <p className={styles.subtitle}>
            Experience ultra-realistic AI interviews and dynamic quizzes. Get instant feedback, 
            identify your weak spots, and land your dream job with confidence.
          </p>
          <div className={styles.ctaGroup}>
            <Link href="/dashboard" className="btn btn-primary hover-lift">
              Get Started for Free
            </Link>
            <Link href="/questions" className="btn btn-secondary hover-lift">
              Explore Questions
            </Link>
          </div>
        </div>
      </div>

      <section className={`container ${styles.featuresSection}`}>
        <h2 style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '1rem' }}>
          Why Choose AI Interview Pro?
        </h2>
        <div className={styles.featuresGrid}>
          
          <div className={`glass-panel hover-lift ${styles.featureCard}`}>
            <div className={styles.featureIcon}>
              <Brain size={24} />
            </div>
            <h3 className={styles.featureTitle}>Adaptive AI Quizzes</h3>
            <p className={styles.featureDesc}>
              Our AI generates questions on-the-fly based on your chosen role and difficulty, 
              ensuring you are always challenged.
            </p>
          </div>

          <div className={`glass-panel hover-lift ${styles.featureCard}`}>
            <div className={styles.featureIcon}>
              <MessageSquare size={24} />
            </div>
            <h3 className={styles.featureTitle}>Realistic Interviews</h3>
            <p className={styles.featureDesc}>
              Chat or speak with our AI interviewer. It asks follow-up questions just like a 
              real hiring manager would.
            </p>
          </div>

          <div className={`glass-panel hover-lift ${styles.featureCard}`}>
            <div className={styles.featureIcon}>
              <Target size={24} />
            </div>
            <h3 className={styles.featureTitle}>Actionable Feedback</h3>
            <p className={styles.featureDesc}>
              Receive a detailed breakdown of your performance, highlighting areas of 
              strength and pinpointing what to improve.
            </p>
          </div>
          
          <div className={`glass-panel hover-lift ${styles.featureCard}`}>
            <div className={styles.featureIcon}>
              <Zap size={24} />
            </div>
            <h3 className={styles.featureTitle}>Instant Results</h3>
            <p className={styles.featureDesc}>
              No waiting days to hear back. Get scored instantly with comprehensive analytics 
              on your technical and soft skills.
            </p>
          </div>

        </div>
      </section>
    </main>
  );
}
