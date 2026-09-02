// Utility functions to manage local user stats with cloud sync backup.
import { getSession } from "next-auth/react";

export interface UserStats {
  interviewsTaken: number;
  totalQuizzes: number;
  totalQuizScore: number;
  totalQuizQuestions: number;
  hoursPracticed: number;
  currentStreak: number;
  lastPracticeDate: string; // YYYY-MM-DD
}

export interface InterviewSession {
  id: string;
  role: string;
  experience: string;
  date: string; // ISO string
  durationMinutes: number;
  messageCount: number; // number of exchanges
  overallScore: number | null; // null until feedback is fetched
  messages: { role: "user" | "ai"; content: string }[];
}

const STATS_KEY = "ai_interview_stats";
const HISTORY_KEY = "ai_interview_history";
const BOOKMARKS_KEY = "ai_interview_bookmarks";
const MAX_SESSIONS = 50; // cap to avoid localStorage overflow
let cloudSyncQueue: Promise<void> = Promise.resolve();

const updateStreak = (stats: UserStats) => {
  const today = new Date().toISOString().split("T")[0];
  if (!stats.lastPracticeDate) {
    stats.currentStreak = 1;
    stats.lastPracticeDate = today;
  } else if (stats.lastPracticeDate !== today) {
    const last = new Date(stats.lastPracticeDate);
    const now = new Date(today);
    const diffDays = Math.round(
      (now.getTime() - last.getTime()) / (1000 * 3600 * 24),
    );
    if (diffDays === 1) {
      stats.currentStreak += 1;
    } else if (diffDays > 1) {
      stats.currentStreak = 1;
    }
    stats.lastPracticeDate = today;
  }
};

// ── Cloud Sync Helper ────────────────────────────────────

export const syncCloudData = async (userEmail: string) => {
  if (typeof window === "undefined" || !userEmail) return;
  try {
    const res = await fetch(
      `/api/user-data?email=${encodeURIComponent(userEmail)}`,
    );
    if (!res.ok) return;
    const data = await res.json();

    const localTimestamp = parseInt(
      localStorage.getItem("cloud_sync_timestamp") || "0",
      10,
    );
    const serverTimestamp = data.syncTimestamp || 0;

    // If local data is newer, push to cloud instead of overwriting local
    if (localTimestamp > serverTimestamp && localTimestamp > 0) {
      pushCloudData(userEmail);
      return;
    }

    // Otherwise, accept cloud data
    localStorage.setItem("cloud_sync_timestamp", serverTimestamp.toString());
    let updated = false;

    if (data.stats) {
      localStorage.setItem(STATS_KEY, JSON.stringify(data.stats));
      updated = true;
    }
    if (data.history && Array.isArray(data.history)) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
      updated = true;
    }
    if (data.bookmarks && Array.isArray(data.bookmarks)) {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(data.bookmarks));
      updated = true;
    }

    if (updated) {
      window.dispatchEvent(new Event("storage"));
    }
  } catch (err) {
    console.error("Failed to sync cloud user data:", err);
  }
};

export const pushCloudData = async (userEmail?: string) => {
  if (typeof window === "undefined") return;
  let email = userEmail;
  if (!email) {
    const session = await getSession();
    email = session?.user?.email || undefined;
  }
  if (!email) return;

  const sync = async () => {
    const stats = getStats();
    const history = getInterviewHistory();
    const bookmarks = getBookmarkedQuestions();
    const timestamp = Date.now();
    localStorage.setItem("cloud_sync_timestamp", timestamp.toString());

    try {
      await fetch("/api/user-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, stats, history, bookmarks, timestamp }),
      });
    } catch (err: any) {
      // Data is safe in localStorage but the cloud copy is stale.
      // This happens on network errors or auth expiry — the next successful action will re-sync.
      console.warn(
        "[Stats] Cloud sync failed — local data is preserved but not pushed to server:",
        err?.message || err,
      );
    }
  };

  cloudSyncQueue = cloudSyncQueue.catch(() => undefined).then(sync);
  await cloudSyncQueue;
};

// ── Stats ──────────────────────────────────────────────────

export const getStats = (): UserStats => {
  if (typeof window === "undefined")
    return {
      interviewsTaken: 0,
      totalQuizzes: 0,
      totalQuizScore: 0,
      totalQuizQuestions: 0,
      hoursPracticed: 0,
      currentStreak: 0,
      lastPracticeDate: "",
    };
  try {
    const data = localStorage.getItem(STATS_KEY);
    const stats = data
      ? JSON.parse(data)
      : {
          interviewsTaken: 0,
          totalQuizzes: 0,
          totalQuizScore: 0,
          totalQuizQuestions: 0,
          hoursPracticed: 0,
          currentStreak: 0,
          lastPracticeDate: "",
        };
    return {
      interviewsTaken: stats.interviewsTaken || 0,
      totalQuizzes: stats.totalQuizzes || 0,
      totalQuizScore: stats.totalQuizScore || 0,
      totalQuizQuestions: stats.totalQuizQuestions || 0,
      hoursPracticed: stats.hoursPracticed || 0,
      currentStreak: stats.currentStreak || 0,
      lastPracticeDate: stats.lastPracticeDate || "",
    };
  } catch {
    return {
      interviewsTaken: 0,
      totalQuizzes: 0,
      totalQuizScore: 0,
      totalQuizQuestions: 0,
      hoursPracticed: 0,
      currentStreak: 0,
      lastPracticeDate: "",
    };
  }
};

export const saveQuizScore = (
  score: number,
  totalQuestions: number,
  durationMinutes: number,
) => {
  const stats = getStats();
  stats.totalQuizzes += 1;
  stats.totalQuizScore += score;
  stats.totalQuizQuestions += totalQuestions;
  stats.hoursPracticed += durationMinutes / 60;
  updateStreak(stats);
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  pushCloudData();
};

export const saveInterviewSession = (durationMinutes: number) => {
  const stats = getStats();
  stats.interviewsTaken += 1;
  stats.hoursPracticed += durationMinutes / 60;
  updateStreak(stats);
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  pushCloudData();
};

// ── History ────────────────────────────────────────────────

export const getInterviewHistory = (): InterviewSession[] => {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveInterviewHistory = (
  session: Omit<InterviewSession, "id">,
): string => {
  const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const sessions = getInterviewHistory();
  sessions.unshift({ ...session, id }); // newest first
  if (sessions.length > MAX_SESSIONS) sessions.splice(MAX_SESSIONS);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
  pushCloudData();
  return id;
};

export const updateSessionScore = (id: string, score: number) => {
  const sessions = getInterviewHistory();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx !== -1) {
    sessions[idx].overallScore = score;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
    pushCloudData();
  }
};

export const deleteInterviewSession = (id: string) => {
  const sessions = getInterviewHistory().filter((s) => s.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
  pushCloudData();
};

export const getSessionById = (id: string): InterviewSession | null => {
  return getInterviewHistory().find((s) => s.id === id) ?? null;
};

// ── Bookmarked Questions ───────────────────────────────────

export interface BookmarkedQuestion {
  id: string;
  question: string;
  role: string;
  date: string;
}

// Bookmarks key is defined at the top

export const getBookmarkedQuestions = (): BookmarkedQuestion[] => {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(BOOKMARKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const toggleBookmarkQuestion = (
  question: string,
  role: string,
): boolean => {
  const bookmarks = getBookmarkedQuestions();
  const existingIdx = bookmarks.findIndex((b) => b.question === question);

  let isBookmarked = false;
  if (existingIdx !== -1) {
    // Remove
    bookmarks.splice(existingIdx, 1);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    isBookmarked = false;
  } else {
    // Add
    const newBookmark: BookmarkedQuestion = {
      id: `bm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      question,
      role: role || "General",
      date: new Date().toISOString(),
    };
    bookmarks.unshift(newBookmark);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    isBookmarked = true;
  }
  pushCloudData();
  return isBookmarked;
};

export const isQuestionBookmarked = (question: string): boolean => {
  const bookmarks = getBookmarkedQuestions();
  return bookmarks.some((b) => b.question === question);
};

export const deleteBookmark = (id: string) => {
  const bookmarks = getBookmarkedQuestions().filter((b) => b.id !== id);
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  pushCloudData();
};
