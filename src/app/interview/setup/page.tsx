'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from '../../quiz/setup/page.module.css'; // Reusing setup styles
import { MessageSquareText, UploadCloud, FileText, X } from 'lucide-react';

export default function InterviewSetup() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [experience, setExperience] = useState('Mid-Level');
  const [mode, setMode] = useState('mixed');
  const [company, setCompany] = useState('general');
  const [persona, setPersona] = useState('strict');
  const [language, setLanguage] = useState('en-US');
  const [jdText, setJdText] = useState('');
  const [timerDuration, setTimerDuration] = useState('120'); // seconds per question
  const [pressureMode, setPressureMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resume, setResume] = useState<File | null>(null);
  const [analyzingResume, setAnalyzingResume] = useState(false);
  const [resumeSkills, setResumeSkills] = useState<string[]>([]);
  const [extractedContext, setExtractedContext] = useState('');
  const [resumeError, setResumeError] = useState('');
  const [_userCredits, setUserCredits] = useState<number | null>(null);
  const [userTier, setUserTier] = useState<'free' | 'pro'>('free');
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Pro Tier Feature Gating Check
    const isProCompany = company && ['google', 'amazon', 'meta', 'microsoft', 'apple'].includes(company);
    const isProPersona = persona && ['architect', 'startup'].includes(persona);
    if ((isProCompany || isProPersona) && userTier !== 'pro') {
      window.dispatchEvent(new CustomEvent('open-pricing-modal'));
      return;
    }

    setLoading(true);

    // 2. Fresh Pre-flight Live Server Credit Check (4.0 Credits for Mock Interview)
    try {
      const userEmail = session?.user?.email || '';
      const headers: Record<string, string> = userEmail ? { 'x-user-email': userEmail } : {};
      const res = await fetch('/api/user-credits', { headers, cache: 'no-store' });
      const data = await res.json();

      const liveCredits = data?.aiCredits;
      const liveTier = data?.tier || 'free';

      if (liveTier !== 'pro' && typeof liveCredits === 'number' && liveCredits < 4.0) {
        setLoading(false);
        window.dispatchEvent(new CustomEvent('user-credits-updated', { detail: { remainingCredits: liveCredits } }));
        window.dispatchEvent(new CustomEvent('open-pricing-modal'));
        alert(`⚠️ Insufficient AI credits (4.0 Credits required for a Mock Interview). You currently have ${liveCredits.toFixed(1)} Credits remaining. Please upgrade or top up!`);
        return;
      }
    } catch (err) {
      console.warn('Error verifying credits before session:', err);
    }

    const finalRole = role.trim() || 'Software Engineer';
    const finalExperience = experience;
    const contextParam = extractedContext;

    router.push(`/interview/run?role=${encodeURIComponent(finalRole)}&experience=${finalExperience}&mode=${mode}&company=${company}&persona=${persona}&lang=${language}&timer=${timerDuration}&pressure=${pressureMode}${jdText.trim() ? `&jd=${encodeURIComponent(jdText.trim())}` : ''}${contextParam ? `&context=${encodeURIComponent(contextParam)}` : ''}`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setResume(file);
      setAnalyzingResume(true);
      setResumeError('');

      const formData = new FormData();
      formData.append('resume', file);
      if (role.trim()) formData.append('targetRole', role.trim());

      try {
        const res = await fetch('/api/analyze-resume', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok || data.error) {
          setResumeError(data.error || 'Currently unable to parse resume due to high AI service traffic. You can paste a Job Description (JD) below or enter a Target Role to generate your interview session!');
        } else {
          if (data.recommendedRole && !role.trim()) {
            setRole(data.recommendedRole);
          }
          if (data.experienceLevel) {
            setExperience(data.experienceLevel);
          }
          if (data.detectedSkills) {
            setResumeSkills(data.detectedSkills);
          }
          if (data.interviewContext) {
            setExtractedContext(data.interviewContext);
            localStorage.setItem('user_resume_context', data.interviewContext);
            localStorage.setItem('last_analyzed_resume_text', data.interviewContext);
          }
        }
      } catch (err) {
        console.error('Resume pre-analysis failed:', err);
        setResumeError('Currently unable to parse resume due to high AI service traffic. You can paste a Job Description (JD) below or enter a Target Role to generate your interview session!');
      } finally {
        setAnalyzingResume(false);
      }
    }
  };

  return (
    <main className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
      <div className={`glass-panel ${styles.setupContainer}`}>
        <div className={styles.setupHeader}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--primary-color)' }}>
            <MessageSquareText size={48} />
          </div>
          <h1>Mock Interview Setup</h1>
          <p>Prepare for a realistic conversational interview with AI.</p>
        </div>

        <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className={styles.formGroup} style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px dashed var(--glass-border)' }}>
            <label className={styles.label} style={{ marginBottom: '1rem', display: 'block' }}>Upload Resume (Optional)</label>
            {!resume ? (
              <div 
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={40} style={{ marginBottom: '0.5rem', color: 'var(--primary-color)' }} />
                <p>Click to upload your resume (PDF)</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>The AI will tailor the interview to your specific experience.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FileText size={24} color="var(--primary-color)" />
                    <span style={{ fontWeight: 500 }}>{resume.name}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { setResume(null); setResumeSkills([]); setExtractedContext(''); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {analyzingResume && (
                  <div style={{ fontSize: '0.85rem', color: '#38bdf8', fontStyle: 'italic' }}>
                    ⚡ Analyzing resume skills & target role...
                  </div>
                )}

                {resumeSkills.length > 0 && !analyzingResume && (
                  <div style={{ fontSize: '0.82rem', color: '#4ade80', background: 'rgba(34,197,94,0.08)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.2)' }}>
                    ✨ Detected Skills: {resumeSkills.join(', ')}
                  </div>
                )}

                {resumeError && !analyzingResume && (
                  <div style={{ fontSize: '0.85rem', color: '#fbbf24', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', padding: '0.85rem 1rem', borderRadius: '10px', lineHeight: 1.5 }}>
                    ⚠️ {resumeError}
                  </div>
                )}
              </div>
            )}
            <input 
              type="file" 
              accept=".pdf" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
            />
          </div>

          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            — OR MANUALLY CONFIGURE —
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="role">Target Job Role</label>
            <input 
              id="role"
              type="text" 
              className={styles.input} 
              placeholder="e.g. Senior Frontend Engineer, Product Manager"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required={!resume}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="experience">Experience Level</label>
            <select 
              id="experience"
              className={`${styles.input} ${styles.select}`}
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
            >
              <option value="Entry-Level">Entry-Level</option>
              <option value="Mid-Level">Mid-Level</option>
              <option value="Senior">Senior</option>
              <option value="Staff/Principal">Staff/Principal</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="mode">🎯 Interview Mode / Focus</label>
            <select
              id="mode"
              className={`${styles.input} ${styles.select}`}
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="mixed">🧠 Mixed (Technical + Behavioral + HR)</option>
              <option value="technical">💻 Technical & System Design</option>
              <option value="rapidfire">⚡ Rapid-Fire Technical Drill (45s per Q)</option>
              <option value="behavioral">🌟 Behavioral (STAR Method)</option>
              <option value="hr">🤝 HR & Culture Fit</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="persona">🎭 AI Interviewer Persona</label>
            <select
              id="persona"
              className={`${styles.input} ${styles.select}`}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
            >
              <option value="strict">🧐 Dr. Strict (Tough Tech Lead — Edge Cases & Big-O Focus)</option>
              <option value="empathetic">🤝 Empathetic Manager (Friendly, Collaborative & STAR Growth)</option>
              <option value="architect">🔬 Principal Architect (High-Scale Systems) 🔒 Pro</option>
              <option value="startup">🚀 Startup Founder (Fast-Paced, Pragmatic & Impact) 🔒 Pro</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="company">🏢 Target Company Prep</label>
            <select
              id="company"
              className={`${styles.input} ${styles.select}`}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              <option value="general">🌐 General / Tech Industry Standard</option>
              <option value="itservices">🏛️ IT Services (Infosys / TCS / Wipro / HCL)</option>
              <option value="google">🔵 Google (Algorithms, System Scale & Googleyness) 🔒 Pro</option>
              <option value="amazon">🟠 Amazon (16 Leadership Principles & STAR) 🔒 Pro</option>
              <option value="microsoft">🟢 Microsoft (OOP, Edge Cases & Trade-offs) 🔒 Pro</option>
              <option value="meta">🔵 Meta / Facebook (Rapid Coding & Scale) 🔒 Pro</option>
              <option value="apple">🍎 Apple (Deep Hardware/OS & Precision) 🔒 Pro</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="jd">
              📄 Job Description {!extractedContext ? <span style={{ color: '#f87171', fontWeight: 600 }}>(Required when no resume is used) *</span> : '(Optional)'}
            </label>
            <textarea
              id="jd"
              className={styles.input}
              rows={3}
              placeholder={!extractedContext ? "Paste Job Description (JD) text here (REQUIRED)... The AI will tailor questions directly to the skills and responsibilities in this JD." : "Paste Job Description (JD) text here... The AI will tailor questions directly to the required skills, tools, and responsibilities mentioned in this JD."}
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              required={!extractedContext}
              style={{ resize: 'vertical', fontFamily: 'inherit', borderColor: (!extractedContext && !jdText.trim()) ? 'rgba(239, 68, 68, 0.4)' : undefined }}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="language">🌐 Interview Language</label>
            <select
              id="language"
              className={`${styles.input} ${styles.select}`}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en-US">🇺🇸 English (US)</option>
              <option value="hi-IN">🇮🇳 Hindi (हिन्दी)</option>
              <option value="es-ES">🇪🇸 Spanish (Español)</option>
              <option value="fr-FR">🇫🇷 French (Français)</option>
              <option value="de-DE">🇩🇪 German (Deutsch)</option>
              <option value="ja-JP">🇯🇵 Japanese (日本語)</option>
            </select>
          </div>


          {/* Timer Settings */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="timer">⏱ Time Per Question</label>
            <select
              id="timer"
              className={`${styles.input} ${styles.select}`}
              value={timerDuration}
              onChange={(e) => setTimerDuration(e.target.value)}
            >
              <option value="0">No Timer (Relaxed Mode)</option>
              <option value="60">1 Minute</option>
              <option value="120">2 Minutes</option>
              <option value="180">3 Minutes</option>
              <option value="300">5 Minutes</option>
            </select>
          </div>

          {timerDuration !== '0' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderRadius: '12px', background: pressureMode ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${pressureMode ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setPressureMode(!pressureMode)}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>🔥 Pressure Mode</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Auto-submits your answer when time runs out</div>
              </div>
              <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: pressureMode ? '#ef4444' : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: pressureMode ? '23px' : '3px', transition: 'left 0.2s' }} />
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary hover-lift" 
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading || analyzingResume || (!extractedContext && !jdText.trim())}
          >
            {loading ? 'Analyzing & Starting Session...' : 'Start Interview Session'}
          </button>

          {(!extractedContext && !jdText.trim()) && (
            <div style={{ textAlign: 'center', fontSize: '0.82rem', color: '#f87171', marginTop: '-0.5rem' }}>
              ⚠️ Please paste a Job Description (JD) above to enable the interview session.
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
