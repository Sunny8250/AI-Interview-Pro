"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  RotateCcw,
  LayoutDashboard,
  History,
  Download,
  Mic,
  BarChart3,
  Share2,
  GraduationCap,
} from "lucide-react";
import { updateSessionScore } from "@/lib/stats";
import styles from "./page.module.css";

interface QuestionFeedback {
  question: string;
  userAnswer: string;
  score: number;
  feedback: string;
  modelAnswer: string;
}

interface FeedbackReport {
  overallScore: number;
  communicationScore: number;
  technicalScore: number;
  confidenceScore: number;
  skillBreakdown?: {
    technicalDepth: number;
    architectureDesign: number;
    communicationStructure: number;
    problemSolvingSpeed: number;
    domainKnowledge: number;
  };
  summary: string;
  strengths: string[];
  areasToImprove: string[];
  studyRoadmap?: string[];
  questionFeedback: QuestionFeedback[];
}

// SVG Score Gauge
function ScoreGauge({ score, color }: { score: number; color: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = ((100 - score) / 100) * circumference;

  return (
    <div className={styles.scoreGauge}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* Background track */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
        />
        {/* Animated progress */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
        />
      </svg>
      <div className={styles.scoreGaugeValue}>{score}</div>
    </div>
  );
}

function getScoreColor(score: number) {
  if (score >= 75) return "#4ade80";
  if (score >= 50) return "#fbbf24";
  return "#f87171";
}

function getScoreBadgeClass(score: number) {
  if (score >= 75) return styles.high;
  if (score >= 50) return styles.mid;
  return styles.low;
}

function cleanMarkdownText(str: string = ""): string {
  return str
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#/g, "")
    .trim();
}

function QACard({ item, index }: { item: QuestionFeedback; index: number }) {
  const [open, setOpen] = useState(false);

  const hasAnswer = Boolean(
    item.userAnswer &&
    item.userAnswer.trim().length > 0 &&
    !item.userAnswer.toLowerCase().includes("no answer provided"),
  );

  let answerBadgeText = "Question Skipped";
  let answerBadgeColor = "#fbbf24"; // yellow
  let answerBadgeBg = "rgba(245,158,11,0.12)";
  let answerBadgeBorder = "rgba(245,158,11,0.25)";
  let answerIcon = "⏸";

  if (hasAnswer) {
    if (item.score >= 75) {
      answerBadgeText = "Strong Answer";
      answerBadgeColor = "#4ade80";
      answerBadgeBg = "rgba(34,197,94,0.12)";
      answerBadgeBorder = "rgba(34,197,94,0.25)";
      answerIcon = "✓";
    } else if (item.score >= 50) {
      answerBadgeText = "Average Answer";
      answerBadgeColor = "#fbbf24";
      answerBadgeBg = "rgba(245,158,11,0.12)";
      answerBadgeBorder = "rgba(245,158,11,0.25)";
      answerIcon = "⚠️";
    } else {
      answerBadgeText = "Poor / Invalid Answer";
      answerBadgeColor = "#f87171";
      answerBadgeBg = "rgba(239,68,68,0.12)";
      answerBadgeBorder = "rgba(239,68,68,0.25)";
      answerIcon = "❌";
    }
  }

  return (
    <div className={styles.qaCard}>
      <div className={styles.qaHeader} onClick={() => setOpen(!open)}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div className={styles.qaQuestion}>
            Q{index + 1}: {cleanMarkdownText(item.question)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: answerBadgeColor,
                background: answerBadgeBg,
                padding: "2px 8px",
                borderRadius: "12px",
                border: `1px solid ${answerBadgeBorder}`,
              }}
            >
              {answerIcon} {answerBadgeText}
            </span>
          </div>
        </div>
        <span
          className={`${styles.qaScoreBadge} ${getScoreBadgeClass(item.score)}`}
        >
          {item.score}/100
        </span>
        <ChevronDown
          size={18}
          className={`${styles.qaChevron} ${open ? styles.open : ""}`}
        />
      </div>

      <div className={`${styles.qaBody} ${open ? styles.open : ""}`}>
        <div
          className={`${styles.qaBlock} ${styles.userAnswer}`}
          style={{
            background: hasAnswer
              ? answerBadgeBg.replace("0.12", "0.06")
              : "rgba(245, 158, 11, 0.06)",
            borderColor: hasAnswer
              ? answerBadgeBorder
              : "rgba(245, 158, 11, 0.2)",
          }}
        >
          <div
            className={styles.qaBlockLabel}
            style={{ color: hasAnswer ? answerBadgeColor : "#fbbf24" }}
          >
            {hasAnswer ? "💬 Candidate Answer" : "⚠️ Candidate Response Status"}
          </div>
          <div
            style={{ color: hasAnswer ? "#f8fafc" : "var(--text-secondary)" }}
          >
            {hasAnswer ? (
              cleanMarkdownText(item.userAnswer)
            ) : (
              <em style={{ color: "#fbbf24" }}>
                No candidate answer provided (Skipped during interview).
              </em>
            )}
          </div>
        </div>

        <div className={`${styles.qaBlock} ${styles.aiFeedback}`}>
          <div className={styles.qaBlockLabel}>🤖 AI Coach Feedback</div>
          <div>{cleanMarkdownText(item.feedback)}</div>
        </div>

        <div className={`${styles.qaBlock} ${styles.modelAnswer}`}>
          <div className={styles.qaBlockLabel}>
            💡 Ideal Model Answer (AI Solution)
          </div>
          <div>{cleanMarkdownText(item.modelAnswer)}</div>
        </div>
      </div>
    </div>
  );
}

function FeedbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  const role = searchParams.get("role") || "Unknown Role";
  const experience = searchParams.get("experience") || "";

  const [fillerCount, setFillerCount] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const raw = sessionStorage.getItem("interviewSession");
    if (!raw) {
      router.push("/dashboard");
      return;
    }

    let storedSession: {
      messages?: unknown;
      sessionId?: unknown;
      fillerCount?: unknown;
    };
    try {
      storedSession = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem("interviewSession");
      setError(
        "This interview session is corrupted. Please start a new interview.",
      );
      setLoading(false);
      return;
    }

    const {
      messages,
      sessionId: sid,
      fillerCount: storedFillers,
    } = storedSession;
    if (
      !Array.isArray(messages) ||
      messages.length < 2 ||
      messages.length > 100 ||
      messages.some((message) => {
        const item = message as { role?: unknown; content?: unknown };
        return (
          !item ||
          !["user", "ai"].includes(String(item.role)) ||
          typeof item.content !== "string" ||
          item.content.length > 4000
        );
      })
    ) {
      setError(
        "This interview session is invalid. Please start a new interview.",
      );
      setLoading(false);
      return;
    }

    const sessionKey = typeof sid === "string" && sid.length <= 100 ? sid : "";
    if (sessionKey) setSessionId(sessionKey);
    if (typeof storedFillers === "number" && Number.isFinite(storedFillers)) {
      setFillerCount(storedFillers);
    }

    // Check cache first to prevent infinite billing drain on refresh
    const cacheKey = `cached_report_${sessionKey || "temp"}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const cachedReport = JSON.parse(cached);
        if (
          cachedReport &&
          typeof cachedReport === "object" &&
          typeof cachedReport.overallScore === "number"
        ) {
          setReport(cachedReport);
          setLoading(false);
          return;
        }
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    fetch("/api/analyze-interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        experience,
        messages,
        clientSessionId: sessionKey || undefined,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setReport(data);
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        // Persist the score to the stored history entry
        if (sessionKey && data.overallScore != null) {
          updateSessionScore(sessionKey, data.overallScore);
        }
      })
      .catch((err) => {
        console.error("Feedback generation error:", err);
        setError(
          err.message ||
            "Could not generate feedback report right now. Please try again in a few moments.",
        );
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.loadingSpinner} />
        <div>
          <h2
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
            }}
          >
            Analyzing Your Interview…
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>
            Our AI coach is reviewing your answers. This takes about 10 seconds.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.loadingState}>
        <AlertTriangle size={48} color="#f87171" />
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>
            Analysis Failed
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            {error}
          </p>
          <Link href="/dashboard" className="btn btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const shareReport = async () => {
    setSharing(true);
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, experience, report }),
      });
      const data = await response.json();
      if (!response.ok || !data.id)
        throw new Error(data.error || "Unable to create a public report");

      await navigator.clipboard.writeText(
        `${window.location.origin}/share/${data.id}`,
      );
      alert("Public report link copied. It expires in 30 days.");
    } catch (shareError: any) {
      alert(
        shareError.message ||
          "Unable to create a public report. Please try again.",
      );
    } finally {
      setSharing(false);
    }
  };

  const scores = [
    { label: "Overall Score", value: report.overallScore, featured: true },
    {
      label: "Technical Accuracy",
      value: report.technicalScore,
      featured: false,
    },
    {
      label: "Communication",
      value: report.communicationScore,
      featured: false,
    },
    { label: "Confidence", value: report.confidenceScore, featured: false },
  ];

  return (
    <>
      <div className={styles.header}>
        <h1>Interview Report</h1>
        <p>
          {role}
          {experience ? ` · ${experience} Level` : ""}
        </p>
      </div>

      {/* Score Gauges */}
      <div className={styles.scoresGrid}>
        {scores.map((s) => (
          <div
            key={s.label}
            className={`${styles.scoreCard} ${s.featured ? styles.featured : ""}`}
          >
            <ScoreGauge score={s.value} color={getScoreColor(s.value)} />
            <div className={styles.scoreLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Multi-Axis Skill Radar Breakdown */}
      {report.skillBreakdown && (
        <div className={styles.skillRadarContainer}>
          <div
            className={styles.sectionTitle}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <BarChart3 size={18} color="#818cf8" /> Multi-Axis Skill Rating
          </div>
          <div className={styles.skillGrid}>
            {[
              {
                label: "Technical Depth",
                val: report.skillBreakdown.technicalDepth,
                color: "#6366f1",
              },
              {
                label: "System Architecture & Design",
                val: report.skillBreakdown.architectureDesign,
                color: "#38bdf8",
              },
              {
                label: "Communication & STAR Structure",
                val: report.skillBreakdown.communicationStructure,
                color: "#4ade80",
              },
              {
                label: "Problem Solving Speed",
                val: report.skillBreakdown.problemSolvingSpeed,
                color: "#fbbf24",
              },
              {
                label: "Domain & Framework Mastery",
                val: report.skillBreakdown.domainKnowledge,
                color: "#ec4899",
              },
            ].map((sb) => (
              <div key={sb.label} className={styles.skillBarItem}>
                <div className={styles.skillBarLabel}>
                  <span>{sb.label}</span>
                  <span style={{ color: sb.color }}>{sb.val}/100</span>
                </div>
                <div className={styles.skillBarTrack}>
                  <div
                    className={styles.skillBarFill}
                    style={{ width: `${sb.val}%`, background: sb.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Speech Fluency & Filler Words Card */}
      {fillerCount !== null && (
        <div className={styles.fluencyCard}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background:
                  fillerCount <= 2
                    ? "rgba(34, 197, 94, 0.12)"
                    : fillerCount <= 5
                      ? "rgba(251, 191, 36, 0.12)"
                      : "rgba(239, 68, 68, 0.12)",
                color:
                  fillerCount <= 2
                    ? "#4ade80"
                    : fillerCount <= 5
                      ? "#fbbf24"
                      : "#f87171",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Mic size={22} />
            </div>
            <div>
              <div
                style={{ fontWeight: 700, fontSize: "1rem", color: "#f8fafc" }}
              >
                Speech Fluency & Hesitancy:{" "}
                {fillerCount <= 2
                  ? "🟢 High Fluency"
                  : fillerCount <= 5
                    ? "🟡 Moderate Hesitancy"
                    : "🔴 Excessive Fillers"}
              </div>
              <div
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                  marginTop: "2px",
                }}
              >
                Detected {fillerCount} vocal filler word
                {fillerCount === 1 ? "" : "s"} (e.g.{" "}
                <em>"um", "uh", "like", "basically"</em>) across your answers.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>📋 Overall Summary</div>
        <p className={styles.summaryText}>{report.summary}</p>
      </div>

      {/* Strengths & Improvements */}
      <div className={styles.listGrid}>
        <div className={`${styles.listCard} ${styles.positive}`}>
          <div className={styles.sectionTitle} style={{ color: "#4ade80" }}>
            <CheckCircle size={18} /> Strengths
          </div>
          {report.strengths.map((s, i) => (
            <div key={i} className={styles.listItem}>
              <span className={`${styles.listBullet} ${styles.green}`}>✓</span>
              {s}
            </div>
          ))}
        </div>
        <div className={`${styles.listCard} ${styles.negative}`}>
          <div className={styles.sectionTitle} style={{ color: "#fbbf24" }}>
            <AlertTriangle size={18} /> Areas to Improve
          </div>
          {report.areasToImprove.map((s, i) => (
            <div key={i} className={styles.listItem}>
              <span className={`${styles.listBullet} ${styles.yellow}`}>!</span>
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* 7-Day AI Custom Study Plan */}
      {report.studyRoadmap && report.studyRoadmap.length > 0 && (
        <div
          className={styles.section}
          style={{
            background: "rgba(99, 102, 241, 0.05)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
          }}
        >
          <div
            className={styles.sectionTitle}
            style={{
              color: "#818cf8",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <GraduationCap size={20} /> 🎓 Personalized 7-Day AI Action Plan
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.75rem",
              marginTop: "1rem",
            }}
          >
            {report.studyRoadmap.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  padding: "0.75rem 1rem",
                  borderRadius: "10px",
                  fontSize: "0.85rem",
                  color: "#e0e7ff",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-question feedback */}
      <div className={styles.qaSection}>
        <div
          className={styles.sectionTitle}
          style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "1rem" }}
        >
          🎯 Question-by-Question Breakdown
        </div>
        {report.questionFeedback.map((item, i) => (
          <QACard key={i} item={item} index={i} />
        ))}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {sessionId && (
          <button
            onClick={shareReport}
            disabled={sharing}
            className="btn btn-secondary"
            style={{
              gap: "8px",
              display: "flex",
              alignItems: "center",
              background: "rgba(99, 102, 241, 0.15)",
              color: "#818cf8",
              border: "1px solid rgba(99, 102, 241, 0.3)",
            }}
          >
            <Share2 size={18} />{" "}
            {sharing ? "Creating Link…" : "Share Public Link"}
          </button>
        )}
        <button
          onClick={() => {
            const mdContent = `# 🚀 AI Interview Preparation Cheat Sheet\nRole: ${role} (${experience})\nScore: ${report.overallScore}%\nDate: ${new Date().toLocaleDateString()}\n\n## 💡 Summary\n${report.summary}\n\n## 🎯 Strengths\n${report.strengths.map((s) => `- ${s}`).join("\n")}\n\n## ⚠️ Areas to Improve\n${report.areasToImprove.map((a) => `- ${a}`).join("\n")}\n\n## 🎓 7-Day Action Plan\n${report.studyRoadmap?.map((r) => `- ${r}`).join("\n") || "N/A"}\n\n## 📚 Questions & Ideal Answers\n${report.questionFeedback.map((q, i) => `### Q${i + 1}: ${q.question}\n**Ideal Answer:** ${q.modelAnswer}\n\n**Your Answer:** ${q.userAnswer}\n**Feedback:** ${q.feedback}\n`).join("\n")}`;
            const blob = new Blob([mdContent], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Interview_CheatSheet_${role.replace(/\s+/g, "_")}.md`;
            a.click();
          }}
          className="btn btn-secondary"
          style={{
            gap: "8px",
            display: "flex",
            alignItems: "center",
            background: "rgba(56, 189, 248, 0.12)",
            color: "#38bdf8",
            border: "1px solid rgba(56, 189, 248, 0.3)",
          }}
        >
          <Download size={18} /> Download Cheat Sheet (.md)
        </button>
        <button
          onClick={() => window.print()}
          className="btn btn-secondary"
          style={{ gap: "8px", display: "flex", alignItems: "center" }}
        >
          <Download size={18} /> PDF Report
        </button>
        <Link
          href="/history"
          className="btn btn-secondary"
          style={{ gap: "8px", display: "flex", alignItems: "center" }}
        >
          <History size={18} /> Session History
        </Link>
        <Link
          href="/interview/setup"
          className="btn btn-primary"
          style={{ gap: "8px", display: "flex", alignItems: "center" }}
        >
          <RotateCcw size={18} /> Practice Again
        </Link>
        <Link
          href="/dashboard"
          className="btn btn-secondary"
          style={{ gap: "8px", display: "flex", alignItems: "center" }}
        >
          <LayoutDashboard size={18} /> Dashboard
        </Link>
      </div>
    </>
  );
}

export default function FeedbackPage() {
  return (
    <div className={styles.feedbackPage}>
      <div className={styles.container}>
        <Suspense
          fallback={
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinner} />
            </div>
          }
        >
          <FeedbackContent />
        </Suspense>
      </div>
    </div>
  );
}
