'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UploadCloud, ArrowRight, Sparkles, AlertCircle, CheckCircle2, XCircle, RotateCcw, Lightbulb, Target } from 'lucide-react';
import styles from './page.module.css';

interface AnalysisResult {
  summary: string;
  recommendedRole: string;
  experienceLevel: string;
  detectedSkills?: string[];
  interviewContext: string;
}

export default function ResumeUpload() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [atsResult, setAtsResult] = useState<any>(null);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [userTier, setUserTier] = useState<'free' | 'pro'>('free');
  const [error, setError] = useState('');

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Please upload a valid PDF file.');
        return;
      }
      setResumeFile(file);
      setError('');
    }
  };

  const handleAnalyzeAll = async () => {
    if (!resumeFile) {
      setError('Please select a PDF resume file first.');
      return;
    }

    // Pre-flight Credit Check (2.0 Credits for ATS Resume Audit)
    if (userTier !== 'pro' && userCredits !== null && userCredits < 2.0) {
      window.dispatchEvent(new CustomEvent('open-pricing-modal'));
      alert(`⚠️ Insufficient AI credits (2.0 Credits required for ATS Resume Audit). You currently have ${userCredits.toFixed(1)} Credits. Please upgrade or top up!`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);
      if (jdText.trim()) {
        formData.append('jd', jdText.trim());
      }

      const userEmail = session?.user?.email || '';
      const headers: Record<string, string> = userEmail ? { 'x-user-email': userEmail } : {};

      // Parallel execution for fast response
      const promises: [Promise<Response>, Promise<Response> | null] = [
        fetch('/api/analyze-resume', { method: 'POST', headers, body: formData }),
        jdText.trim() ? fetch('/api/analyze-ats', { method: 'POST', headers, body: formData }) : null,
      ];

      const [res1, res2] = await Promise.all(promises);

      const data1 = await res1.json();
      if (!res1.ok) {
        if (data1?.code === 'OUT_OF_CREDITS' || res1.status === 402) {
          window.dispatchEvent(new CustomEvent('open-pricing-modal'));
        }
        throw new Error(data1.error || 'Failed to analyze resume');
      }
      setResult(data1);

      if (data1.remainingCredits !== undefined) {
        window.dispatchEvent(new CustomEvent('user-credits-updated', { detail: { remainingCredits: data1.remainingCredits } }));
      }

      if (data1.interviewContext) {
        localStorage.setItem('user_resume_context', data1.interviewContext);
        localStorage.setItem('last_analyzed_resume_text', data1.interviewContext);
      }

      if (res2) {
        const data2 = await res2.json();
        if (res2.ok && data2 && typeof data2.atsScore === 'number') {
          setAtsResult(data2);
          if (data2.remainingCredits !== undefined) {
            window.dispatchEvent(new CustomEvent('user-credits-updated', { detail: { remainingCredits: data2.remainingCredits } }));
          }
        } else {
          if (data2?.code === 'OUT_OF_CREDITS' || res2.status === 402) {
            window.dispatchEvent(new CustomEvent('open-pricing-modal'));
          }
          console.warn('ATS match analysis error:', data2?.error);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startInterview = () => {
    if (!result) return;
    const url = `/interview/run?role=${encodeURIComponent(result.recommendedRole)}&experience=${encodeURIComponent(result.experienceLevel)}${jdText.trim() ? `&jd=${encodeURIComponent(jdText.trim())}` : ''}&context=${encodeURIComponent(result.interviewContext)}`;
    router.push(url);
  };

  return (
    <main className="container animate-fade-in" style={{ paddingBottom: '4rem', paddingTop: '1.5rem' }}>
      <div className={`glass-panel ${styles.container}`}>
        <div className={styles.header}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem', background: 'linear-gradient(135deg, #6366f1, #ec4899, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            <Sparkles size={32} color="#6366f1" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Resume Profile & ATS Match Audit
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '650px', margin: '0 auto' }}>
            Upload your PDF resume and paste your target Job Description (JD) for an instant ATS Match audit & custom interview setup.
          </p>
        </div>

        {!loading && !result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Upload Area */}
            <div className={styles.uploadArea}>
              <input 
                type="file" 
                accept=".pdf" 
                className={styles.fileInput} 
                onChange={handleFileSelect}
              />
              <div className={styles.uploadContent}>
                <UploadCloud size={48} className={styles.uploadIcon} />
                <div className={styles.uploadText}>
                  {resumeFile ? `📄 ${resumeFile.name}` : 'Click or Drag & Drop your Resume (PDF)'}
                </div>
                <div className={styles.uploadHint}>
                  {resumeFile ? 'Click to replace file' : 'PDF format only'}
                </div>
              </div>
            </div>

            {/* Job Description Input Box - ALWAYS VISIBLE */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '0.5rem', color: '#f8fafc', fontSize: '0.95rem' }}>
                <Target size={18} color="#38bdf8" /> Target Job Description (JD) — Paste Here
              </label>
              <textarea
                className={styles.jdTextarea}
                rows={6}
                placeholder="Paste the Job Description (JD) text here... (e.g. required skills, frameworks, responsibilities)&#10;Our AI will calculate your ATS Match Score and tailor 100% of your mock interview questions to this JD."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
            </div>

            <button 
              type="button"
              className="btn btn-primary hover-lift" 
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 700 }}
              onClick={handleAnalyzeAll}
              disabled={!resumeFile}
            >
              Analyze Resume & Audit ATS Match
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div className={styles.spinner}></div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 700 }}>Analyzing Resume & JD Match...</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Extracting skills, evaluating ATS keyword density & building profile.</p>
          </div>
        )}

        {error && (
          <div style={{ color: '#f87171', padding: '1rem', background: 'rgba(239,68,68,0.1)', borderRadius: '14px', marginTop: '1.5rem', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* ULTRA-PREMIUM RESULTS DASHBOARD */}
        {result && !loading && (
          <div className={`animate-fade-in ${styles.analysisResult}`}>
            {/* Top Grid Banner: Candidate Profile + ATS Score Ring */}
            <div className={styles.gridBanner}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>
                    {result.recommendedRole}
                  </span>
                  <span style={{ background: 'rgba(99,102,241,0.18)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', padding: '3px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
                    {result.experienceLevel}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                  {result.summary}
                </p>

                {/* Detected Skills Pills */}
                {result.detectedSkills && result.detectedSkills.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '1rem' }}>
                    {result.detectedSkills.map((skill, sIdx) => (
                      <span key={sIdx} className={styles.skillPill}>
                        ✓ {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ATS Score Card Ring */}
              {atsResult ? (
                <div className={styles.atsCircleBadge} style={{ borderColor: atsResult.atsScore >= 70 ? 'rgba(74,222,128,0.4)' : 'rgba(251,191,36,0.4)' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 700 }}>
                    ATS Match Score
                  </div>
                  <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1, margin: '8px 0', color: atsResult.atsScore >= 70 ? '#4ade80' : atsResult.atsScore >= 40 ? '#fbbf24' : '#f87171' }}>
                    {atsResult.atsScore}%
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: atsResult.atsScore >= 70 ? '#4ade80' : atsResult.atsScore >= 40 ? '#fbbf24' : '#f87171' }}>
                    {atsResult.matchRating}
                  </div>
                </div>
              ) : (
                <div className={styles.atsCircleBadge}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    No JD provided for ATS Scoring.
                  </div>
                </div>
              )}
            </div>

            {/* Keyword Match & Gap Breakdown Cards */}
            {atsResult && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Matching Keywords */}
                <div style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '1.25rem', borderRadius: '16px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
                    <CheckCircle2 size={18} /> Matched ATS Keywords ({atsResult.matchingKeywords?.length || 0})
                  </h4>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {atsResult.matchingKeywords && atsResult.matchingKeywords.length > 0 ? (
                      atsResult.matchingKeywords.map((kw: string, i: number) => (
                        <span key={i} className={`${styles.keywordTag} ${styles.matchTag}`}>
                          ✓ {kw}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No matching keywords found.</span>
                    )}
                  </div>
                </div>

                {/* Missing Keywords */}
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1.25rem', borderRadius: '16px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
                    <XCircle size={18} /> Missing Keywords & Skill Gaps ({atsResult.missingKeywords?.length || 0})
                  </h4>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {atsResult.missingKeywords && atsResult.missingKeywords.length > 0 ? (
                      atsResult.missingKeywords.map((kw: string, i: number) => (
                        <span key={i} className={`${styles.keywordTag} ${styles.missingTag}`}>
                          ⚠️ {kw}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No missing keywords detected!</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* AI Recommendations */}
            {atsResult?.recommendations && atsResult.recommendations.length > 0 && (
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
                  <Lightbulb size={18} /> AI Recruiter Optimization Tips
                </h4>
                <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                  {atsResult.recommendations.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
              <button 
                className="btn btn-primary hover-lift" 
                style={{ flex: 1, minWidth: '240px', padding: '1rem', fontSize: '1.05rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={startInterview}
              >
                Start JD-Tailored Mock Interview
                <ArrowRight size={20} />
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '1rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                onClick={() => { setResult(null); setAtsResult(null); }}
              >
                <RotateCcw size={18} /> New Upload
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
