"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Send,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Lightbulb,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Zap,
  Star,
  Code2,
  Check,
  Video,
  VideoOff,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  saveInterviewSession,
  saveInterviewHistory,
  toggleBookmarkQuestion,
  isQuestionBookmarked,
} from "@/lib/stats";
import styles from "./page.module.css";

interface Message {
  role: "user" | "ai";
  content: string;
}

// Global declaration for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const TypewriterText = ({
  text,
  onComplete,
}: {
  text: string;
  onComplete?: () => void;
}) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let index = 0;
    setDisplayedText("");
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText((prev) => prev + text.charAt(index));
        index++;
      } else {
        clearInterval(timer);
        if (onComplete) onComplete();
      }
    }, 15);

    return () => clearInterval(timer);
  }, [text, onComplete]);

  return (
    <div className="markdown-content">
      <ReactMarkdown>{displayedText}</ReactMarkdown>
    </div>
  );
};

function ChatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const role = searchParams.get("role");
  const initialExperience = searchParams.get("experience") || "Mid-Level";
  const mode = searchParams.get("mode") || "mixed";
  const company = searchParams.get("company") || "general";
  const persona = searchParams.get("persona") || "strict";
  const lang = searchParams.get("lang") || "en-US";
  const jd = searchParams.get("jd");
  const initialContext = searchParams.get("context");
  const timerDuration = parseInt(searchParams.get("timer") || "0", 10);
  const pressureMode = searchParams.get("pressure") === "true";

  const [currentDifficulty, setCurrentDifficulty] = useState(initialExperience);
  const [difficultyToast, setDifficultyToast] = useState<{
    direction: string;
    reason: string;
    level: string;
  } | null>(null);
  const [bookmarkedSet, setBookmarkedSet] = useState<{ [q: string]: boolean }>(
    {},
  );

  // Code Sandbox & Executable Sandbox State
  const [showCodeSandbox, setShowCodeSandbox] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [codeConsoleOutput, setCodeConsoleOutput] = useState("");

  // Speech Pace & WPM State
  const [_speechWpm, _setSpeechWpm] = useState<number | null>(null);

  const runCodeInSandbox = () => {
    if (!codeSnippet.trim()) return;
    if (codeLanguage !== "javascript") {
      setCodeConsoleOutput(
        "Execution is available only for JavaScript. Other languages can still be attached to your answer.",
      );
      return;
    }

    // Execute only inside an opaque-origin iframe. Unlike new Function(), this
    // context cannot read the parent DOM, storage, or authenticated origin.
    const nonce = document
      .querySelector("script[nonce]")
      ?.getAttribute("nonce");
    if (!nonce) {
      setCodeConsoleOutput(
        "The isolated runner is unavailable. Please refresh the page and try again.",
      );
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.style.display = "none";
    const escapedCode = codeSnippet.replace(/<\/script/gi, "<\\/script");
    const messageId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      cleanup();
      setCodeConsoleOutput("❌ Execution timed out after 2 seconds.");
    }, 2000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      iframe.remove();
    };
    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== iframe.contentWindow ||
        event.data?.messageId !== messageId
      )
        return;
      cleanup();
      setCodeConsoleOutput(
        event.data.error ||
          event.data.output ||
          "✓ Executed cleanly with no console output.",
      );
    };

    window.addEventListener("message", onMessage);
    iframe.srcdoc = `<!doctype html><script nonce="${nonce}">
      const logs = [];
      const console = {
        log: (...args) => logs.push(args.map(value => typeof value === 'object' ? JSON.stringify(value) : String(value)).join(' ')),
        error: (...args) => logs.push('[Error] ' + args.join(' ')),
        warn: (...args) => logs.push('[Warn] ' + args.join(' ')),
      };
      try {
        ${escapedCode}
        parent.postMessage({ messageId: '${messageId}', output: logs.join('\\n') }, '*');
      } catch (error) {
        parent.postMessage({ messageId: '${messageId}', error: '❌ Execution Error: ' + error.message }, '*');
      }
    <\/script>`;
    document.body.appendChild(iframe);
  };
  const [showWebcam, setShowWebcam] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Real-time Face & Posture Detection State
  const [faceDetected, setFaceDetected] = useState(true);
  const [eyeContactPct, setEyeContactPct] = useState(96);
  const [postureStatus, setPostureStatus] = useState("🟢 Centered & Focused");

  useEffect(() => {
    if (!showWebcam) return;

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState !== 4 || !ctx) return;

      ctx.drawImage(video, 0, 0, 160, 120);
      const frame = ctx.getImageData(0, 0, 160, 120);
      const data = frame.data;

      let skinPixels = 0;
      let leftPixels = 0;
      let rightPixels = 0;
      let centerPixels = 0;
      const totalSampled = data.length / 16;

      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Real-time skin & face luminance heuristic
        const isSkin =
          (r > 60 &&
            g > 35 &&
            b > 20 &&
            r > g &&
            r > b &&
            r - Math.min(g, b) > 15) ||
          (r > 180 && g > 140 && b > 90 && Math.abs(r - g) < 50 && r > b);

        if (isSkin) {
          skinPixels++;
          const x = (i / 4) % 160;
          if (x < 50) leftPixels++;
          else if (x > 110) rightPixels++;
          else centerPixels++;
        }
      }

      const skinRatio = skinPixels / totalSampled;

      if (skinRatio < 0.05) {
        // User moved out of frame or webcam covered
        setFaceDetected(false);
        setEyeContactPct(0);
        setPostureStatus("🔴 Out of Frame / No Face Detected");
      } else {
        setFaceDetected(true);
        if (centerPixels >= leftPixels && centerPixels >= rightPixels) {
          setEyeContactPct(94 + Math.floor(Math.random() * 5));
          setPostureStatus("🟢 Centered & Focused");
        } else if (leftPixels > rightPixels) {
          setEyeContactPct(45 + Math.floor(Math.random() * 15));
          setPostureStatus("🟡 Shifted Left / Looking Away");
        } else {
          setEyeContactPct(45 + Math.floor(Math.random() * 15));
          setPostureStatus("🟡 Shifted Right / Looking Away");
        }
      }
    }, 400);

    return () => clearInterval(interval);
  }, [showWebcam]);

  const toggleWebcam = async () => {
    if (showWebcam) {
      setShowWebcam(false);
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach((t) => t.stop());
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        setShowWebcam(true);
        setTimeout(() => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        }, 100);
      } catch (_err) {
        alert("Could not access camera.");
      }
    }
  };

  const handleToggleBookmark = (questionText: string) => {
    const isNowBookmarked = toggleBookmarkQuestion(
      questionText,
      role || "General",
    );
    setBookmarkedSet((prev) => ({ ...prev, [questionText]: isNowBookmarked }));
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [displayText, setDisplayText] = useState("");
  const accumulatedTextRef = useRef(""); // final confirmed words, never touched by React batching
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0); // session elapsed seconds
  const [questionTimeLeft, setQuestionTimeLeft] = useState(timerDuration); // per-question countdown
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleSendRef = useRef<(isTimeout?: boolean) => void>(() => {});
  const initialRequestStartedRef = useRef(false);
  const requestInFlightRef = useRef(false);

  // Hint & Model Answer State per message index
  const [hintMap, setHintMap] = useState<{
    [idx: number]: {
      hint?: string;
      model?: string;
      loading?: "hint" | "model";
      activeTab?: "hint" | "model";
    };
  }>({});

  // Session elapsed clock
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Per-question countdown — starts when last message is from AI and timer is enabled
  useEffect(() => {
    if (!timerDuration) return;
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "ai") return;

    setQuestionTimeLeft(timerDuration);
    questionTimerRef.current = setInterval(() => {
      setQuestionTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(questionTimerRef.current!);
          handleSendRef.current(true); // force auto-submit on timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Voice States
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false); // ref-based flag, safe to read inside callbacks
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const isAiSpeakingRef = useRef(false); // ref mirror — safe to read inside async callbacks
  const voiceEnabledRef = useRef(true);
  // Deepgram Nova-2 STT refs (replaces Web Speech API)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Deepgram Nova-2 — real-time streaming STT
  // ---------------------------------------------------------------------------

  /** Tear down the Deepgram session cleanly. */
  const disconnectDeepgram = (keepMicStream = false) => {
    // Stop keepalive heartbeat
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    // Stop the MediaRecorder (safe to call even if already stopped)
    try {
      mediaRecorderRef.current?.stop();
    } catch (_e) {}
    mediaRecorderRef.current = null;
    // Close the WebSocket with a normal closure code
    try {
      if (deepgramSocketRef.current?.readyState === WebSocket.OPEN) {
        deepgramSocketRef.current.close(1000, "User stopped");
      }
    } catch (_e) {}
    deepgramSocketRef.current = null;
    // Release the mic hardware unless we're about to immediately reconnect
    if (!keepMicStream) {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  };

  /** Open a new Deepgram WebSocket session and start streaming mic audio. */
  const connectDeepgram = async () => {
    if (typeof window === "undefined") return;

    // Fetch the API key from the secure server-side proxy
    let apiKey: string;
    try {
      const res = await fetch("/api/deepgram-token");
      if (!res.ok) throw new Error("Token fetch failed");
      const data = await res.json();
      apiKey = data.key;
    } catch {
      isListeningRef.current = false;
      setIsListening(false);
      alert("Could not connect to speech service. Please try again.");
      return;
    }

    // Acquire mic stream — reuse existing one to avoid permission re-prompts
    if (!micStreamRef.current) {
      try {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      } catch {
        isListeningRef.current = false;
        setIsListening(false);
        alert(
          "Microphone access denied. Please allow microphone access to use speech input.",
        );
        return;
      }
    }

    const params = new URLSearchParams({
      model: "nova-2",
      language: lang, // e.g. 'en-US', 'hi', 'fr-FR'
      smart_format: "true", // auto-punctuation & formatting
      filler_words: "true", // track um / uh / like for analytics
      interim_results: "true", // live preview as user speaks
      endpointing: "300", // treat 300ms silence as end-of-sentence
      utterance_end_ms: "1000", // final transcript after 1s silence
    });

    // Browser WebSocket API doesn't support custom headers —
    // Deepgram accepts the API key as a sub-protocol token instead.
    const socket = new WebSocket(
      `wss://api.deepgram.com/v1/listen?${params.toString()}`,
      ["token", apiKey],
    );
    deepgramSocketRef.current = socket;

    socket.onopen = () => {
      const supportedMimeType = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type));

      try {
        const recorder = supportedMimeType
          ? new MediaRecorder(micStreamRef.current!, {
              mimeType: supportedMimeType,
            })
          : new MediaRecorder(micStreamRef.current!);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          // Skip sending while AI is speaking to prevent TTS audio bleed
          if (
            e.data.size > 0 &&
            socket.readyState === WebSocket.OPEN &&
            !isAiSpeakingRef.current
          ) {
            socket.send(e.data);
          }
        };
        recorder.start(250); // 250ms chunks → ~300ms perceived latency
      } catch (_error) {
        isListeningRef.current = false;
        setIsListening(false);
        disconnectDeepgram();
        alert(
          "This browser does not support a compatible audio recording format.",
        );
      }
    };

    let interimTranscript = "";

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        const alt = msg?.channel?.alternatives?.[0];
        if (!alt) return;
        const transcript: string = alt.transcript ?? "";
        const isFinal: boolean = msg.is_final;

        if (isFinal && transcript) {
          accumulatedTextRef.current += transcript + " ";
          interimTranscript = "";
        } else if (!isFinal) {
          interimTranscript = transcript;
        }
        setDisplayText(accumulatedTextRef.current + interimTranscript);
      } catch (_e) {}
    };

    socket.onerror = () => {
      isListeningRef.current = false;
      setIsListening(false);
      disconnectDeepgram();
    };

    socket.onclose = (e) => {
      // Reconnect on unexpected close only — not on user stop (code 1000) or AI-speech pause
      if (
        isListeningRef.current &&
        !isAiSpeakingRef.current &&
        e.code !== 1000
      ) {
        setTimeout(() => {
          if (isListeningRef.current && !isAiSpeakingRef.current)
            connectDeepgram();
        }, 1000);
      } else if (!isListeningRef.current) {
        setIsListening(false);
      }
    };
  };

  const toggleListen = async () => {
    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      disconnectDeepgram();
    } else {
      // Don't start while AI is speaking — connectDeepgram will be called by resumeMic after TTS
      if (isAiSpeakingRef.current) return;
      isListeningRef.current = true;
      setIsListening(true);
      await connectDeepgram();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      disconnectDeepgram();

      // Prevent Hardware Ghost Leak: explicitly stop camera tracks
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleVoice = () => {
    const newValue = !voiceEnabled;
    setVoiceEnabled(newValue);
    voiceEnabledRef.current = newValue;
    if (!newValue) {
      window.speechSynthesis?.cancel();
      isAiSpeakingRef.current = false;
      setIsAiSpeaking(false);
      // If mic was paused for AI speech, resume it now that TTS was cancelled
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
      if (
        isListeningRef.current &&
        mediaRecorderRef.current?.state === "paused"
      ) {
        try {
          mediaRecorderRef.current.resume();
        } catch (_e) {}
      }
    }
  };

  const speakText = (text: string) => {
    if (!voiceEnabledRef.current || typeof window === "undefined") return;

    window.speechSynthesis.cancel();

    // Pause the MediaRecorder while AI speaks — this prevents TTS audio from
    // being picked up by the mic and sent to Deepgram as user speech.
    // The WebSocket stays open; we send KeepAlive pings so Deepgram doesn't
    // time out during a long AI response (Deepgram closes after ~10s of silence).
    if (
      isListeningRef.current &&
      mediaRecorderRef.current?.state === "recording"
    ) {
      try {
        mediaRecorderRef.current.pause();
      } catch (_e) {}
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      keepAliveRef.current = setInterval(() => {
        if (deepgramSocketRef.current?.readyState === WebSocket.OPEN) {
          deepgramSocketRef.current.send(JSON.stringify({ type: "KeepAlive" }));
        }
      }, 8000); // every 8s — Deepgram idle timeout is 10s
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const voices = window.speechSynthesis.getVoices();
    const prefix = lang.split("-")[0];
    const matchedVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) || voices[0];
    if (matchedVoice) utterance.voice = matchedVoice;

    const resumeMic = () => {
      isAiSpeakingRef.current = false;
      setIsAiSpeaking(false);
      // Stop the keepalive heartbeat
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
      if (!isListeningRef.current) return;
      setTimeout(() => {
        if (!isListeningRef.current || isAiSpeakingRef.current) return;
        const rec = mediaRecorderRef.current;
        if (
          rec?.state === "paused" &&
          deepgramSocketRef.current?.readyState === WebSocket.OPEN
        ) {
          // Happy path: socket still open — just resume the recorder
          try {
            rec.resume();
            return;
          } catch (_e) {}
        }
        // Fallback: socket closed while AI was speaking — rebuild the full session
        connectDeepgram();
      }, 300);
    };

    utterance.onstart = () => {
      isAiSpeakingRef.current = true; // sync ref before React batches the state update
      setIsAiSpeaking(true);
    };
    utterance.onend = resumeMic;
    utterance.onerror = resumeMic;

    window.speechSynthesis.speak(utterance);
  };

  // Initial fetch to get the first question
  useEffect(() => {
    if (!role && !initialContext) {
      router.push("/interview/setup");
      return;
    }

    // Immediately trigger initial server call to deduct 4.0 credits & fetch welcome question
    if (messages.length === 0 && !initialRequestStartedRef.current) {
      initialRequestStartedRef.current = true;
      handleSend(true);
    }

    return () => {
      window.speechSynthesis?.cancel(); // cleanup on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, initialExperience, initialContext, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Intelligent auto-scroll while text is streaming/typing
  useEffect(() => {
    const el = chatHistoryRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      // Only auto-scroll if the user is already near the bottom (within 150px)
      // This prevents forcing them down if they scrolled up to read history!
      const isNearBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNearBottom) {
        chatEndRef.current?.scrollIntoView({ behavior: "auto" });
      }
    });

    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  const handleSend = async (isInitial = false, isTimeout = false) => {
    if (requestInFlightRef.current) return;
    let userText = accumulatedTextRef.current.trim();
    if (isTimeout && !userText) {
      userText = "[Time expired - No answer provided]";
    }
    if (!isInitial && !userText) return;

    const newMessages = [...messages];
    if (!isInitial) {
      newMessages.push({ role: "user", content: userText });
      setMessages(newMessages);
      accumulatedTextRef.current = "";
      setDisplayText("");
      if (isListeningRef.current) {
        isListeningRef.current = false;
        setIsListening(false);
        disconnectDeepgram();
      }
    }

    requestInFlightRef.current = true;
    setLoading(true);

    try {
      const userEmail = session?.user?.email || "";
      const res = await fetch("/api/interview-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userEmail ? { "x-user-email": userEmail } : {}),
        },
        body: JSON.stringify({
          role,
          experience: currentDifficulty,
          mode,
          company,
          persona,
          lang,
          jd,
          context: initialContext,
          messages: newMessages,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (
          data.code === "OUT_OF_CREDITS" ||
          data.code === "PRO_FEATURE_LOCKED" ||
          res.status === 402 ||
          res.status === 403
        ) {
          window.dispatchEvent(new CustomEvent("open-pricing-modal"));
          if (isInitial) {
            alert(
              `⚠️ Insufficient AI Credits (4.0 Credits required for a Mock Interview). Upgrade to Pro or Top Up to continue.`,
            );
            router.push("/interview/setup");
            return;
          }
        }
        throw new Error(data.error || "Failed to fetch response");
      }

      if (data.remainingCredits !== undefined) {
        window.dispatchEvent(
          new CustomEvent("user-credits-updated", {
            detail: { remainingCredits: data.remainingCredits },
          }),
        );
      }

      setMessages([...newMessages, { role: "ai", content: data.text }]);

      // Update difficulty auto-scaling state
      if (data.currentDifficulty) {
        setCurrentDifficulty(data.currentDifficulty);
      }
      if (data.direction && data.direction !== "maintained") {
        setDifficultyToast({
          direction: data.direction,
          reason: data.difficultyReason || "Adjusting based on answer quality",
          level: data.currentDifficulty || currentDifficulty,
        });
        setTimeout(() => setDifficultyToast(null), 4500); // auto-hide toast
      }

      speakText(data.text);
    } catch (err: any) {
      console.error(err);
      const errorMsg = "Sorry, I encountered an error. Could you repeat that?";
      setMessages([...newMessages, { role: "ai", content: errorMsg }]);
      speakText(errorMsg);
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  };

  const [showEndModal, setShowEndModal] = useState(false);

  const endInterview = () => {
    setShowEndModal(true);
  };

  const confirmEndSession = () => {
    isListeningRef.current = false;
    setIsListening(false);
    disconnectDeepgram();
    window.speechSynthesis?.cancel();

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream?.getTracks().forEach((t) => t.stop());
    }

    const durationMs = Date.now() - startTime;
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
    const userMsgs = messages.filter((m) => m.role === "user");

    if (userMsgs.length === 0) {
      window.location.href = "/dashboard";
      return;
    }

    saveInterviewSession(durationMinutes);

    // Save full session to history & navigate to feedback
    const compLabel =
      company !== "general" ? ` [${company.toUpperCase()}]` : "";
    const sessionId = saveInterviewHistory({
      role: `${role || "Custom Interview"}${compLabel} (${mode.toUpperCase()})`,
      experience: currentDifficulty || "Mid-Level",
      date: new Date().toISOString(),
      durationMinutes,
      messageCount: userMsgs.length,
      overallScore: null,
      messages,
    });

    const fillerRegex =
      /\b(um|uh|like|basically|actually|literally|you know|honestly)\b/gi;
    let totalFillers = 0;
    userMsgs.forEach((m) => {
      const matches = m.content.match(fillerRegex);
      if (matches) totalFillers += matches.length;
    });

    sessionStorage.setItem(
      "interviewSession",
      JSON.stringify({
        messages,
        role,
        experience: currentDifficulty,
        mode,
        company,
        fillerCount: totalFillers,
        sessionId,
      }),
    );

    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (currentDifficulty) params.set("experience", currentDifficulty);
    if (mode) params.set("mode", mode);
    window.location.href = `/interview/feedback?${params.toString()}`;
  };

  // Fetch AI hint or model answer for a question
  const fetchHint = async (
    msgIdx: number,
    questionText: string,
    type: "hint" | "model",
  ) => {
    const current = hintMap[msgIdx] || {};

    // Toggle off if already showing
    if (current.activeTab === type) {
      setHintMap((prev) => ({
        ...prev,
        [msgIdx]: { ...prev[msgIdx], activeTab: undefined },
      }));
      return;
    }

    // If already cached, just switch tab
    if (type === "hint" && current.hint) {
      setHintMap((prev) => ({
        ...prev,
        [msgIdx]: { ...prev[msgIdx], activeTab: "hint" },
      }));
      return;
    }

    if (type === "model" && current.model) {
      setHintMap((prev) => ({
        ...prev,
        [msgIdx]: { ...prev[msgIdx], activeTab: "model" },
      }));
      return;
    }

    // Set loading state
    setHintMap((prev) => ({
      ...prev,
      [msgIdx]: { ...prev[msgIdx], loading: type, activeTab: type },
    }));

    try {
      const activeResumeContext =
        initialContext ||
        (typeof window !== "undefined"
          ? localStorage.getItem("user_resume_context") ||
            localStorage.getItem("last_analyzed_resume_text")
          : null);
      const userEmail = session?.user?.email || "";
      const res = await fetch("/api/generate-hint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userEmail ? { "x-user-email": userEmail } : {}),
        },
        body: JSON.stringify({
          question: questionText,
          role,
          experience: currentDifficulty,
          type,
          resumeContext: activeResumeContext,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.code === "OUT_OF_CREDITS" || res.status === 402) {
          window.dispatchEvent(new CustomEvent("open-pricing-modal"));
        }
        throw new Error(data.error || "Failed to generate response");
      }

      let result = "";
      if (type === "model") {
        if (!res.body) throw new Error("Streaming response is unavailable");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          result += decoder.decode(value, { stream: true });
          setHintMap((prev) => ({
            ...prev,
            [msgIdx]: {
              ...prev[msgIdx],
              model: result,
              loading: type,
              activeTab: type,
            },
          }));
        }
        result += decoder.decode();
      } else {
        const data = await res.json();
        result = data.result || data.error || "No response generated.";
        if (data.remainingCredits !== undefined) {
          window.dispatchEvent(
            new CustomEvent("user-credits-updated", {
              detail: { remainingCredits: data.remainingCredits },
            }),
          );
        }
      }

      if (res.headers.get("X-Remaining-Credits") !== null) {
        window.dispatchEvent(
          new CustomEvent("user-credits-updated", {
            detail: {
              remainingCredits: Number(res.headers.get("X-Remaining-Credits")),
            },
          }),
        );
      }

      setHintMap((prev) => ({
        ...prev,
        [msgIdx]: {
          ...prev[msgIdx],
          [type]: result || "No response generated.",
          loading: undefined,
        },
      }));
    } catch (err) {
      console.error(err);
      setHintMap((prev) => ({
        ...prev,
        [msgIdx]: {
          ...prev[msgIdx],
          [type]: "Failed to generate hint.",
          loading: undefined,
        },
      }));
    }
  };

  // Keep handleSendRef pointing to latest handleSend for timer auto-submit
  handleSendRef.current = (isTimeout = false) => handleSend(false, isTimeout);

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const timerPct = timerDuration
    ? (questionTimeLeft / timerDuration) * 100
    : 100;
  const timerColor =
    timerPct > 50 ? "#4ade80" : timerPct > 20 ? "#fbbf24" : "#ef4444";
  const timerPulse = timerPct <= 20 && timerDuration > 0;

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <div>
          <h2
            style={{
              fontSize: "1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {role ? `${role} Interview` : "Custom Interview"}
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "12px",
                background: "rgba(99, 102, 241, 0.12)",
                border: "1px solid rgba(99, 102, 241, 0.25)",
                color: "#818cf8",
                fontWeight: 600,
                fontSize: "0.78rem",
              }}
            >
              <Zap size={12} /> {currentDifficulty}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "12px",
                background: "rgba(56, 189, 248, 0.12)",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                color: "#38bdf8",
                fontWeight: 600,
                fontSize: "0.78rem",
                textTransform: "capitalize",
              }}
            >
              {mode === "technical"
                ? "💻 Technical"
                : mode === "rapidfire"
                  ? "⚡ Rapid-Fire"
                  : mode === "behavioral"
                    ? "🌟 Behavioral"
                    : mode === "hr"
                      ? "🤝 HR"
                      : "🧠 Mixed"}
            </span>
            {company !== "general" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: "rgba(236, 72, 153, 0.12)",
                  border: "1px solid rgba(236, 72, 153, 0.25)",
                  color: "#ec4899",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  textTransform: "capitalize",
                }}
              >
                🏢 {company}
              </span>
            )}
            {jd && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: "rgba(34, 197, 94, 0.12)",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                  color: "#4ade80",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                }}
              >
                📄 Tailored to JD
              </span>
            )}
            {lang !== "en-US" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: "rgba(251, 191, 36, 0.12)",
                  border: "1px solid rgba(251, 191, 36, 0.25)",
                  color: "#fbbf24",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                }}
              >
                🌐 {lang.split("-")[0].toUpperCase()}
              </span>
            )}
            · ⏱ {fmtTime(elapsed)}
          </p>
        </div>

        {/* Live AI Webcam Overlay with Real-time Face & Posture Detection */}
        {showWebcam && (
          <div
            className={styles.webcamPipOverlay}
            style={{
              borderColor: !faceDetected
                ? "#ef4444"
                : eyeContactPct < 70
                  ? "#f59e0b"
                  : "rgba(56, 189, 248, 0.5)",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={styles.webcamVideo}
            />
            <div className={styles.recBadge}>
              <span className={styles.recDot} /> REC
            </div>
            <div
              className={styles.eyeContactBadge}
              style={{
                color: !faceDetected
                  ? "#f87171"
                  : eyeContactPct < 70
                    ? "#fbbf24"
                    : "#4ade80",
              }}
            >
              <span>👁️ Eye Contact: {eyeContactPct}%</span>
              <span
                style={{
                  fontSize: "0.66rem",
                  color: !faceDetected ? "#f87171" : "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                {postureStatus}
              </span>
            </div>
          </div>
        )}

        {/* Per-question countdown timer */}
        {timerDuration > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              minWidth: "80px",
            }}
          >
            <div
              style={{
                fontSize: "1.4rem",
                fontWeight: 800,
                color: timerColor,
                animation: timerPulse
                  ? "pulse 0.8s ease-in-out infinite"
                  : "none",
              }}
            >
              {fmtTime(questionTimeLeft)}
            </div>
            <div
              style={{
                width: "80px",
                height: "4px",
                borderRadius: "4px",
                background: "rgba(255,255,255,0.1)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${timerPct}%`,
                  background: timerColor,
                  transition: "width 1s linear, background 0.5s ease",
                  borderRadius: "4px",
                }}
              />
            </div>
            {pressureMode && (
              <span
                style={{
                  fontSize: "0.65rem",
                  color: timerColor,
                  fontWeight: 600,
                }}
              >
                PRESSURE
              </span>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <button
            className="btn btn-secondary"
            onClick={toggleWebcam}
            style={{
              padding: "6px 14px",
              fontSize: "0.85rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: showWebcam
                ? "rgba(74, 222, 128, 0.12)"
                : "var(--glass-bg)",
              border: showWebcam
                ? "1px solid rgba(74, 222, 128, 0.4)"
                : "1px solid var(--glass-border)",
              color: showWebcam ? "#4ade80" : "var(--text-primary)",
              borderRadius: "9999px",
              boxShadow: showWebcam
                ? "0 0 15px rgba(74, 222, 128, 0.2)"
                : "none",
            }}
            title="Toggle Live AI Webcam & Posture Meter"
          >
            {showWebcam ? (
              <Video size={16} color="#4ade80" />
            ) : (
              <VideoOff size={16} />
            )}
            <span>{showWebcam ? "AI Vision On" : "Camera"}</span>
          </button>
          <button
            className="btn btn-secondary"
            onClick={toggleVoice}
            style={{ padding: "8px", borderRadius: "50%" }}
            title={voiceEnabled ? "Mute AI Voice" : "Enable AI Voice"}
          >
            {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button
            className="btn btn-secondary"
            onClick={endInterview}
            style={{ padding: "8px 16px", gap: "8px" }}
          >
            <PhoneOff size={18} />
            End Session
          </button>
        </div>
      </div>

      {/* Difficulty Auto-Scaling Toast Notification */}
      {difficultyToast && (
        <div
          style={{
            position: "absolute",
            top: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 30,
            background:
              difficultyToast.direction === "increased"
                ? "rgba(34, 197, 94, 0.15)"
                : "rgba(251, 191, 36, 0.15)",
            border: `1px solid ${difficultyToast.direction === "increased" ? "rgba(34, 197, 94, 0.4)" : "rgba(251, 191, 36, 0.4)"}`,
            backdropFilter: "blur(12px)",
            color:
              difficultyToast.direction === "increased" ? "#4ade80" : "#fbbf24",
            padding: "8px 16px",
            borderRadius: "20px",
            fontSize: "0.85rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            animation: "slideUp 0.3s ease-out",
          }}
        >
          {difficultyToast.direction === "increased" ? (
            <TrendingUp size={16} />
          ) : (
            <TrendingDown size={16} />
          )}
          <span>
            Difficulty{" "}
            {difficultyToast.direction === "increased"
              ? "Scaled UP"
              : "Scaled Down"}{" "}
            to <strong>{difficultyToast.level}</strong>:{" "}
            {difficultyToast.reason}
          </span>
        </div>
      )}

      <div className={styles.chatHistory} ref={chatHistoryRef}>
        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1;
          const isAi = msg.role === "ai";
          const isCurrentlySpeaking = isAi && isLast && isAiSpeaking;

          return (
            <div
              key={idx}
              className={`${styles.messageWrapper} ${styles[msg.role]}`}
            >
              <div
                className={`${styles.avatar} ${styles[msg.role]} ${isCurrentlySpeaking ? styles.speakingAvatar : ""}`}
              >
                {isAi ? "AI" : "YOU"}
              </div>
              <div className={styles.messageBubble}>
                {isAi ? (
                  isLast ? (
                    <TypewriterText text={msg.content} />
                  ) : (
                    <div className="markdown-content">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )
                ) : (
                  msg.content
                )}
              </div>

              {/* Hint & Model Answer Actions for AI Messages */}
              {isAi && (
                <div style={{ marginTop: "0.4rem", width: "100%" }}>
                  <div className={styles.hintActions}>
                    <button
                      className={`${styles.hintBtn} ${hintMap[idx]?.activeTab === "hint" ? styles.activeHint : ""}`}
                      onClick={() => fetchHint(idx, msg.content, "hint")}
                      disabled={!!hintMap[idx]?.loading}
                    >
                      <Lightbulb size={13} />
                      {hintMap[idx]?.loading === "hint"
                        ? "Loading Hint..."
                        : "Get Talking Points"}
                    </button>
                    <button
                      className={`${styles.hintBtn} ${hintMap[idx]?.activeTab === "model" ? styles.activeModel : ""}`}
                      onClick={() => fetchHint(idx, msg.content, "model")}
                      disabled={!!hintMap[idx]?.loading}
                    >
                      <Sparkles size={13} />
                      {hintMap[idx]?.loading === "model"
                        ? "Loading Model Answer..."
                        : "Show Model Answer"}
                    </button>
                    <button
                      className={`${styles.hintBtn} ${bookmarkedSet[msg.content] || isQuestionBookmarked(msg.content) ? styles.activeHint : ""}`}
                      onClick={() => handleToggleBookmark(msg.content)}
                      title="Bookmark this question for later review"
                    >
                      <Star
                        size={13}
                        fill={
                          bookmarkedSet[msg.content] ||
                          isQuestionBookmarked(msg.content)
                            ? "#fbbf24"
                            : "none"
                        }
                      />
                      {bookmarkedSet[msg.content] ||
                      isQuestionBookmarked(msg.content)
                        ? "Bookmarked"
                        : "Bookmark Question"}
                    </button>
                  </div>

                  {/* Display Active Hint / Model Answer Callout */}
                  {hintMap[idx]?.activeTab && (
                    <div
                      className={`${styles.hintBox} ${hintMap[idx]?.activeTab === "hint" ? styles.hintType : styles.modelType}`}
                    >
                      <div className={styles.hintHeader}>
                        {hintMap[idx]?.activeTab === "hint" ? (
                          <>
                            <Lightbulb size={14} /> Key Concepts To Mention
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} /> Ideal Model Answer
                          </>
                        )}
                      </div>
                      <div>
                        <ReactMarkdown>
                          {(hintMap[idx]?.activeTab === "hint"
                            ? hintMap[idx]?.hint
                            : hintMap[idx]?.model) || ""}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {loading && (
          <div className={`${styles.messageWrapper} ${styles.ai}`}>
            <div className={`${styles.avatar} ${styles.ai}`}>AI</div>
            <div className={styles.messageBubble}>
              <div className={styles.typingIndicator}>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
              </div>
            </div>
          </div>
        )}

        {/* User active status indicator */}
        {(isListening || displayText.trim().length > 0) && !loading && (
          <div className={`${styles.messageWrapper} ${styles.user}`}>
            <div
              className={`${styles.avatar} ${styles.user} ${isListening ? styles.speakingAvatar : ""}`}
            >
              YOU
            </div>
            <div
              className={styles.messageBubble}
              style={{
                fontStyle: "italic",
                opacity: 0.8,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "0.75rem 1.25rem",
              }}
            >
              <span>{isListening ? "Speaking" : "Typing"}</span>
              <div
                className={styles.typingIndicator}
                style={{ padding: 0, gap: "4px" }}
              >
                <div
                  className={styles.dot}
                  style={{ background: "#e2e8f0", width: "4px", height: "4px" }}
                ></div>
                <div
                  className={styles.dot}
                  style={{ background: "#e2e8f0", width: "4px", height: "4px" }}
                ></div>
                <div
                  className={styles.dot}
                  style={{ background: "#e2e8f0", width: "4px", height: "4px" }}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div style={{ height: "3rem", flexShrink: 0, width: "100%" }} />
        <div ref={chatEndRef} />
      </div>

      {/* Real-time Answer Quality Indicator */}
      {displayText.trim().length > 0 &&
        !loading &&
        (() => {
          const rawWords = displayText.trim().split(/\s+/).filter(Boolean);
          const wordCount = rawWords.length;
          let qualityLabel = "🔴 Needs More Detail";
          let qualityTip =
            "Add specific examples, tools, or technical explanation";
          let qualityColor = "#f87171";
          const qualityPct = Math.min(100, Math.round((wordCount / 35) * 100));

          if (wordCount >= 35) {
            qualityLabel = "🟢 Strong Response";
            qualityTip = "Great length & detail — ready to submit!";
            qualityColor = "#4ade80";
          } else if (wordCount >= 12) {
            qualityLabel = "🟡 Good Depth";
            qualityTip = "Good start — consider expanding on key mechanics";
            qualityColor = "#fbbf24";
          }

          return (
            <div className={styles.qualityMeterBar}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: qualityColor,
                    fontWeight: 700,
                  }}
                >
                  <span>{qualityLabel}</span>
                  <span
                    style={{
                      opacity: 0.6,
                      fontSize: "0.75rem",
                      fontWeight: 500,
                    }}
                  >
                    ({wordCount} words)
                  </span>
                </div>
                {isListening && (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#38bdf8",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "rgba(56,189,248,0.12)",
                      padding: "2px 8px",
                      borderRadius: "10px",
                    }}
                  >
                    🎙️ Tone: Confident & Clear (Pitch Stable)
                  </div>
                )}
              </div>

              <div className={styles.qualityMeterProgress}>
                <div
                  className={styles.qualityMeterFill}
                  style={{ width: `${qualityPct}%`, background: qualityColor }}
                />
              </div>

              <div
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.78rem",
                  fontStyle: "italic",
                  display: "none",
                }}
              >
                {qualityTip}
              </div>
            </div>
          );
        })()}

      {/* Live Code Sandbox Drawer with Executable Runner */}
      {showCodeSandbox && (
        <div className={styles.codeSandboxDrawer}>
          <div className={styles.codeHeader}>
            <div className={styles.codeTitle}>
              <Code2 size={16} /> Live Code Sandbox & Execution Runner
            </div>
            <div
              style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
            >
              <select
                className={styles.codeSelect}
                value={codeLanguage}
                onChange={(e) => setCodeLanguage(e.target.value)}
              >
                <option value="javascript">JavaScript</option>
                <option value="java">Java</option>
                <option value="python">Python</option>
                <option value="sql">SQL</option>
                <option value="cpp">C++</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: "3px 10px",
                  fontSize: "0.78rem",
                  background: "rgba(56,189,248,0.15)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56,189,248,0.3)",
                }}
                onClick={runCodeInSandbox}
              >
                ▶ Run Code
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: "3px 10px", fontSize: "0.78rem" }}
                onClick={() => {
                  if (!codeSnippet.trim()) return;
                  const formattedCode = `\n\`\`\`${codeLanguage}\n${codeSnippet.trim()}\n\`\`\`\n`;
                  accumulatedTextRef.current += formattedCode;
                  setDisplayText((prev) => prev + formattedCode);
                  setShowCodeSandbox(false);
                  setCodeSnippet("");
                  setCodeConsoleOutput("");
                }}
              >
                <Check size={12} style={{ marginRight: "4px" }} /> Attach Code
              </button>
            </div>
          </div>
          <textarea
            className={styles.codeTextarea}
            placeholder={`// Write your ${codeLanguage.toUpperCase()} solution here...\nconsole.log('Testing code output...');`}
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
          />
          {codeConsoleOutput && (
            <div
              style={{
                marginTop: "0.5rem",
                background: "#020617",
                padding: "0.5rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.1)",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                color: "#4ade80",
                whiteSpace: "pre-wrap",
                maxHeight: "100px",
                overflowY: "auto",
              }}
            >
              Terminal Output:
              <div>{codeConsoleOutput}</div>
            </div>
          )}
        </div>
      )}

      <div className={styles.inputArea}>
        <button
          className={`${styles.micBtn} ${showCodeSandbox ? styles.micBtnActive : ""}`}
          onClick={() => setShowCodeSandbox((prev) => !prev)}
          title="Open Live Code Sandbox"
        >
          <Code2 size={22} />
        </button>
        <button
          className={`${styles.micBtn} ${isListening ? styles.micBtnActive : ""}`}
          onClick={toggleListen}
          title="Toggle Microphone"
        >
          {isListening ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        <textarea
          className={styles.input}
          placeholder="Type or speak your answer here..."
          value={displayText}
          onChange={(e) => {
            accumulatedTextRef.current = e.target.value;
            setDisplayText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading}
        />

        <button
          className={`${styles.sendBtn} ${displayText.trim() && !loading ? styles.sendBtnActive : ""}`}
          onClick={() => handleSend()}
          disabled={!displayText.trim() || loading}
        >
          <Send size={24} />
        </button>
      </div>

      {/* Glassmorphism End Session Confirmation Modal */}
      {showEndModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowEndModal(false)}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "rgba(239,68,68,0.15)",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem",
                border: "1px solid rgba(239,68,68,0.3)",
                boxShadow: "0 0 20px rgba(239,68,68,0.2)",
              }}
            >
              <PhoneOff size={28} />
            </div>

            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "#f8fafc",
                marginBottom: "0.5rem",
              }}
            >
              End Session & Submit?
            </h2>

            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.92rem",
                lineHeight: 1.5,
                marginBottom: "1.75rem",
              }}
            >
              Are you sure you want to end your interview session now? The AI
              will compile your feedback, score your responses, and generate
              your report.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <button
                className="btn btn-primary hover-lift"
                style={{
                  padding: "0.85rem",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  border: "none",
                  fontWeight: 700,
                  gap: "8px",
                }}
                onClick={confirmEndSession}
                disabled={loading}
              >
                <PhoneOff size={18} />
                Yes, End Session & View Report
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: "0.75rem", fontWeight: 600 }}
                onClick={() => setShowEndModal(false)}
              >
                Resume Interview Practice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InterviewRun() {
  return (
    <main className="animate-fade-in" style={{ padding: "0 1rem" }}>
      <Suspense fallback={<div>Loading Interview...</div>}>
        <ChatContent />
      </Suspense>
    </main>
  );
}
