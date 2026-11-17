import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Camera,
  Check,
  MessageSquare,
  Mic,
  Pause,
  Play,
  ScanLine,
  Send,
  Square,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { api, type Procedure, type Config } from "./types";
import { Badge, Empty, SectionHeading } from "./ui";

const post = (body: unknown, method = "POST") => ({
  method,
  body: JSON.stringify(body),
});
type Lesson = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  questions: string[];
  gaps: string[];
  status: string;
  procedureId: string;
  procedureVersion: number;
  sourceId?: string;
  progress?: {
    completed: number[];
    completedAt: string | null;
    updatedAt?: string;
  };
};
type Signal = { id: string; title: string; detail: string; page: string };
type Message = { role: "user" | "assistant"; text: string; at: string };
type Feedback = {
  reply: string;
  observations: string[];
  uncertainties: string[];
  checkedAt: string;
};

export function Briefing({
  root,
  navigate,
}: {
  root: string;
  navigate: (page: string) => void;
}) {
  const [signals, setSignals] = useState<Signal[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const c = new AbortController();
    const load = () =>
      api<Signal[]>(root + "/briefing", { signal: c.signal })
        .then((s) => {
          if (active) {
            setSignals(s);
            setError("");
          }
        })
        .catch((e) => {
          if (active && e.name !== "AbortError")
            setError("Briefing could not refresh.");
        });
    void load();
    const t = setInterval(() => void load(), 60000);
    return () => {
      active = false;
      c.abort();
      clearInterval(t);
    };
  }, [root]);
  return (
    <section className="briefing">
      <div className="briefing-label">
        <span className="status-pip" /> WORKSPACE PULSE{" "}
        <small>Live records · refreshes every minute</small>
      </div>
      {error ? (
        <p role="status">{error}</p>
      ) : signals.length ? (
        signals.map((s) => (
          <button key={s.id} onClick={() => navigate(s.page)}>
            <div>
              <strong>{s.title}</strong>
              <p>{s.detail}</p>
            </div>
            <ArrowUpRight size={20} />
          </button>
        ))
      ) : (
        <p className="muted">
          No pending alerts. Your workspace is ready for the next lesson.
        </p>
      )}
    </section>
  );
}

export function Lessons({
  root,
  procedures,
  canEdit,
  onProcedures,
}: {
  root: string;
  procedures: Procedure[];
  canEdit: boolean;
  onProcedures: () => void;
}) {
  const [lessons, setLessons] = useState<Lesson[]>([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const next = await api<Lesson[]>(root + "/lessons");
    setLessons(next);
    setSelected((current) => {
      if (next.some((l) => l.id === current)) return current;
      const recent = [...next]
        .filter((l) => l.progress)
        .sort((a, b) =>
          (
            b.progress?.updatedAt ||
            b.progress?.completedAt ||
            ""
          ).localeCompare(
            a.progress?.updatedAt || a.progress?.completedAt || "",
          ),
        );
      return (
        recent[0]?.id ||
        next.find((l) => l.status === "published")?.id ||
        next[0]?.id ||
        ""
      );
    });
  }, [root]);
  useEffect(() => {
    void reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [reload]);
  const lesson = lessons.find((l) => l.id === selected);
  async function saveProgress(current: Lesson, completed: number[]) {
    if (busy) return;
    setBusy(true);
    setError("");
    const update = (progress: Lesson["progress"]) =>
      setLessons((all) =>
        all.map((l) => (l.id === current.id ? { ...l, progress } : l)),
      );
    update({ completed, completedAt: null });
    try {
      const saved = await api<NonNullable<Lesson["progress"]>>(
        root + `/lessons/${current.id}/progress`,
        post({ completed }, "PUT"),
      );
      update(saved);
    } catch (e) {
      update(current.progress);
      setError(
        `Progress was not confirmed saved. Please try again. ${(e as Error).message}`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function mutate(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
      await reload().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  const sources = procedures.filter(
    (p) =>
      p.status === "approved" && !lessons.some((l) => l.procedureId === p.id),
  );
  return (
    <div className="learning-page">
      <SectionHeading title="The learning studio" />
      <p className="page-intro">
        Turn what your team knows into something everyone can learn.
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {canEdit && (
        <div className="lesson-create">
          <BookOpen />
          <div>
            <strong>Build from a reviewed procedure</strong>
            <p>
              Uploaded content creates drafts automatically. Review its
              procedure, then publish the lesson here.
            </p>
          </div>
          <select
            aria-label="Approved source procedure"
            defaultValue=""
            disabled={busy || !sources.length}
            onChange={(e) => {
              if (e.target.value)
                void mutate(async () => {
                  const l = await api<Lesson>(
                    root + "/lessons",
                    post({ procedureId: e.target.value }),
                  );
                  setSelected(l.id);
                });
              e.target.value = "";
            }}
          >
            <option value="">
              {sources.length
                ? "Choose a procedure…"
                : "No new approved procedures"}
            </option>
            {sources.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <button className="secondary" onClick={onProcedures}>
            Review procedures
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading lessons…</p>
      ) : !lessons.length ? (
        <Empty title="Your first lesson starts with a source">
          Upload a document, photo or video and request analysis. Review the
          generated procedure before publishing its lesson.
        </Empty>
      ) : (
        <div className="studio-layout">
          <div className="lesson-list">
            {lessons.map((l, i) => (
              <button
                key={l.id}
                className={
                  "lesson-tile " + (selected === l.id ? "selected" : "")
                }
                onClick={() => setSelected(l.id)}
              >
                <span className="eyebrow">
                  LESSON {String(i + 1).padStart(2, "0")}{" "}
                  <Badge status={l.status} />
                </span>
                <h2>{l.title}</h2>
                <p>
                  {l.steps.length} steps · source v{l.procedureVersion}
                </p>
                <progress
                  aria-label={`${l.title} progress`}
                  value={l.progress?.completed.length || 0}
                  max={l.steps.length || 1}
                />
                <small>
                  {l.progress?.completedAt
                    ? "Completed"
                    : `${l.progress?.completed.length || 0} of ${l.steps.length} reviewed`}
                </small>
                <ArrowUpRight size={20} />
              </button>
            ))}
          </div>
          <section className="lesson-player">
            {lesson ? (
              <>
                <span className="eyebrow">
                  {lesson.status === "published"
                    ? "REVIEWED LEARNING MATERIAL"
                    : "DRAFT · NOT READY FOR TRAINING"}
                </span>
                <h2>{lesson.title}</h2>
                {lesson.status === "published" && (
                  <section
                    className={
                      "learner-progress " +
                      (lesson.progress?.completedAt ? "is-complete" : "")
                    }
                    aria-label="Your lesson progress"
                  >
                    <div className="progress-summary">
                      <strong>
                        {Math.round(
                          ((lesson.progress?.completed.length || 0) /
                            Math.max(lesson.steps.length, 1)) *
                            100,
                        )}
                        % complete
                      </strong>
                      <span>
                        {lesson.progress?.completed.length || 0} /{" "}
                        {lesson.steps.length} steps
                      </span>
                    </div>
                    <progress
                      aria-label="Current lesson completion"
                      value={lesson.progress?.completed.length || 0}
                      max={lesson.steps.length || 1}
                    />
                    <p role="status">
                      {busy
                        ? "Saving progress…"
                        : error
                          ? "Progress needs attention. Check the message above."
                          : lesson.progress
                            ? "Progress saved automatically"
                            : "Check off each step to save your progress automatically."}
                    </p>
                    {lesson.progress?.completedAt && !busy && (
                      <div className="lesson-completion">
                        <Check size={24} />
                        <div>
                          <h3>Lesson completed</h3>
                          <p>
                            Completed on{" "}
                            {new Date(
                              lesson.progress.completedAt,
                            ).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                            . Your progress is saved to your account.
                          </p>
                        </div>
                      </div>
                    )}
                  </section>
                )}
                <p>{lesson.summary}</p>
                {lesson.sourceId && (
                  <a
                    className="text-button"
                    href={`/api${root}/media/${lesson.sourceId}/file`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View original evidence <ArrowUpRight size={16} />
                  </a>
                )}
                {lesson.status === "draft" && canEdit && (
                  <div className="notice">
                    Review and approve the linked procedure first. Publishing
                    copies its current approved content.
                    <button
                      disabled={busy}
                      className="primary"
                      onClick={() =>
                        void mutate(() =>
                          api(root + `/lessons/${lesson.id}/publish`, post({})),
                        )
                      }
                    >
                      Publish reviewed lesson
                    </button>
                  </div>
                )}
                <ol className="lesson-steps">
                  {lesson.steps.map((step, i) => (
                    <li key={i}>
                      <label>
                        <input
                          type="checkbox"
                          disabled={busy || lesson.status !== "published"}
                          checked={
                            lesson.progress?.completed.includes(i) || false
                          }
                          onChange={(e) => {
                            const completed = new Set(
                              lesson.progress?.completed || [],
                            );
                            if (e.target.checked) completed.add(i);
                            else completed.delete(i);
                            void saveProgress(lesson, [...completed]);
                          }}
                        />
                        <span>
                          <small>STEP {String(i + 1).padStart(2, "0")}</small>
                          {step}
                        </span>
                      </label>
                    </li>
                  ))}
                </ol>
                {!!lesson.questions.length && (
                  <section className="knowledge-check">
                    <h3>Pause & reflect</h3>
                    <p className="muted">
                      Self-study questions. Completion records acknowledgement,
                      not a scored competency assessment.
                    </p>
                    {lesson.questions.map((q, i) => (
                      <p key={i}>
                        {i + 1}. {q}
                      </p>
                    ))}
                  </section>
                )}
                {!!lesson.gaps.length && (
                  <div className="notice">
                    <strong>Evidence gaps</strong>
                    {lesson.gaps.map((g, i) => (
                      <p key={i}>{g}</p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Empty title="Choose a lesson">
                Read each step, inspect its source, and save your progress.
              </Empty>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// Web Speech is a progressive enhancement. Browsers may use their own speech service.
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function Assistant({
  root,
  config,
  navigate,
}: {
  root: string;
  config: Config | null;
  navigate: (page: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [listening, setListening] = useState(false),
    [loading, setLoading] = useState(true),
    [speak, setSpeak] = useState(false);
  const recognition = useRef<Recognition | null>(null),
    abort = useRef<AbortController | null>(null),
    mounted = useRef(true),
    bottom = useRef<HTMLDivElement>(null);
  const speakPreference = useRef(speak);
  speakPreference.current = speak;
  const speechWindow = window as SpeechWindow;
  const Speech =
    speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
  useEffect(() => {
    mounted.current = true;
    const c = new AbortController();
    void api<Message[]>(root + "/assistant", { signal: c.signal })
      .then(setMessages)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => {
      mounted.current = false;
      c.abort();
      abort.current?.abort();
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, [root]);
  useEffect(() => {
    const container = bottom.current?.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);
  function dictate() {
    if (!Speech) return;
    if (listening) {
      recognition.current?.abort();
      return;
    }
    const r = new Speech();
    recognition.current = r;
    r.lang = navigator.language;
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      if (mounted.current)
        setInput((s) => (s + " " + e.results[0][0].transcript).trim());
    };
    r.onerror = (e) => {
      if (mounted.current)
        setError(`Voice input: ${e.error}. You can still type your message.`);
    };
    r.onend = () => {
      if (mounted.current) setListening(false);
    };
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Microphone could not start. Check browser permissions.");
    }
  }
  async function send() {
    if (!input.trim() || busy || loading || listening) return;
    setBusy(true);
    setError("");
    const c = new AbortController();
    abort.current = c;
    try {
      const next = await api<Message[]>(root + "/assistant", {
        ...post({ message: input }),
        signal: c.signal,
      });
      if (!mounted.current) return;
      setMessages(next);
      setInput("");
      if (speakPreference.current && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(
          new SpeechSynthesisUtterance(next.at(-1)?.text || ""),
        );
      }
    } catch (e) {
      if (mounted.current && (e as Error).name !== "AbortError")
        setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="assistant-layout">
      <section className="chat-panel">
        <header>
          <span className="assistant-mark">
            <MessageSquare />
          </span>
          <div>
            <span className="eyebrow">MASTERGROW ASSISTANT</span>
            <h2>A second set of eyes.</h2>
            <p>
              {config?.aiEnabled
                ? `${config.provider} · API key configured`
                : "AI connection needed"}{" "}
              · General operations
            </p>
          </div>
        </header>
        <div className="chat-messages" aria-live="polite">
          {!messages.length && (
            <div className="chat-welcome">
              <h2>
                Start with a question.
                <br />
                Leave with a next step.
              </h2>
              <p>
                Ask about reviewed procedures, training records, or how to
                organize your source material.
              </p>
              {[
                "What should I review today?",
                "Summarize my approved procedures",
                "How do I turn a source into a lesson?",
              ].map((s) => (
                <button
                  className="prompt-chip"
                  disabled={busy || loading}
                  key={s}
                  onClick={() => setInput(s)}
                >
                  {s}
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <article className={"chat-message " + m.role} key={i}>
              <small>{m.role === "assistant" ? "MASTERGROW" : "YOU"}</small>
              <p className="preserve">{m.text}</p>
            </article>
          ))}
          {busy && <p role="status">Reviewing your question…</p>}
          <div ref={bottom} />
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <form
          className="chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="chat-message">Message your assistant</label>
          <textarea
            id="chat-message"
            disabled={busy || loading}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={4000}
            placeholder="Ask about your workspace…"
            rows={3}
          />
          <div className="chat-tools">
            <button
              type="button"
              className="secondary"
              disabled={!Speech || busy || loading}
              onClick={dictate}
            >
              {listening ? <Square size={17} /> : <Mic size={17} />}{" "}
              {listening ? "Stop microphone" : "Dictate"}
            </button>
            <label className="voice-toggle">
              <input
                type="checkbox"
                checked={speak}
                disabled={!window.speechSynthesis}
                onChange={(e) => {
                  setSpeak(e.target.checked);
                  if (!e.target.checked) window.speechSynthesis?.cancel();
                }}
              />
              <Volume2 size={17} /> Read replies aloud
            </label>
            <button
              className="primary"
              disabled={
                busy ||
                loading ||
                listening ||
                !input.trim() ||
                !config?.aiEnabled
              }
            >
              <Send size={17} />
              Send
            </button>
          </div>
          <small className="muted">
            Dictation may send audio to your browser’s speech service. Review
            the transcript before sending. Voice support varies by browser.
          </small>
        </form>
      </section>
      <aside className="assistant-aside">
        <Briefing root={root} navigate={navigate} />
        <div className="notice">
          <strong>You stay in control</strong>
          <p>
            Proactive reminders come from workspace records. Chat uses approved
            procedures and your recent conversation, with no ability to change
            records.
          </p>
          <p>
            Your conversation is private to your account within this workspace.
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(root + "/assistant", { method: "DELETE" });
                setMessages([]);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <X size={16} />
            Clear conversation
          </button>
        </div>
      </aside>
    </div>
  );
}

export function Capture({
  root,
  procedures,
  config,
  onUploaded,
}: {
  root: string;
  procedures: Procedure[];
  config: Config | null;
  onUploaded: () => void;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [starting, setStarting] = useState(false),
    [watching, setWatching] = useState(false),
    [feedback, setFeedback] = useState<Feedback | null>(null),
    [pid, setPid] = useState(""),
    [step, setStep] = useState(0),
    [analyze, setAnalyze] = useState(true),
    [title, setTitle] = useState(""),
    [audio, setAudio] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    live = useRef<MediaStream | null>(null),
    epoch = useRef(0),
    inFlight = useRef(false),
    request = useRef<AbortController | null>(null),
    checks = useRef(0);
  const approved = procedures.filter((p) => p.status === "approved"),
    p = approved.find((p) => p.id === pid);
  const stop = useCallback(() => {
    epoch.current++;
    live.current?.getTracks().forEach((t) => t.stop());
    live.current = null;
    setStream(null);
    setWatching(false);
    setStarting(false);
    request.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [stop]);
  useEffect(() => {
    if (video.current) {
      video.current.srcObject = stream;
      if (stream)
        void video.current
          .play()
          .catch(() => setError("Tap the camera preview to begin playback."));
    }
  }, [stream]);
  async function start() {
    stop();
    setError("");
    setStarting(true);
    const token = epoch.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera access needs HTTPS or localhost. You can use the file picker below.",
        );
      const s = await navigator.mediaDevices.getUserMedia({
        video: device
          ? { deviceId: { exact: device } }
          : { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      if (token !== epoch.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      live.current = s;
      setStream(s);
      setDevices(
        (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "videoinput",
        ),
      );
    } catch (e) {
      if (token === epoch.current) setError((e as Error).message);
    } finally {
      if (token === epoch.current) setStarting(false);
    }
  }
  function frame() {
    const v = video.current;
    if (!v || !v.videoWidth || !live.current)
      throw new Error("Wait for the camera image before capturing.");
    const c = document.createElement("canvas"),
      ratio = Math.min(1, 768 / v.videoWidth, 768 / v.videoHeight);
    c.width = Math.round(v.videoWidth * ratio);
    c.height = Math.round(v.videoHeight * ratio);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.55);
  }
  async function upload(file: File) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", title.trim() || file.name);
      form.set("analyze", String(analyze));
      await api(root + "/media", { method: "POST", body: form });
      setStatus("Source saved to your private library.");
      onUploaded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function snapshot() {
    try {
      const bytes = Uint8Array.from(atob(frame().split(",")[1]), (c) =>
        c.charCodeAt(0),
      );
      await upload(
        new File([bytes], `capture-${Date.now()}.jpg`, { type: "image/jpeg" }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const observe = useCallback(async () => {
    if (inFlight.current || !live.current || !pid) return;
    inFlight.current = true;
    const token = epoch.current,
      c = new AbortController();
    request.current = c;
    setError("");
    try {
      const result = await api<Feedback>(root + "/observe", {
        ...post({ procedureId: pid, step, image: frame() }),
        signal: c.signal,
      });
      if (token !== epoch.current) return;
      setFeedback(result);
      if (audio && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(
          new SpeechSynthesisUtterance(result.reply),
        );
      }
      checks.current++;
      if (checks.current >= 20) {
        setWatching(false);
        setStatus("Guidance paused after 20 checks. Restart when ready.");
      }
    } catch (e) {
      if (token === epoch.current && (e as Error).name !== "AbortError") {
        setError((e as Error).message);
        setWatching(false);
      }
    } finally {
      inFlight.current = false;
    }
  }, [root, pid, step, audio]);
  useEffect(() => {
    if (!watching) return;
    void observe();
    const t = setInterval(() => void observe(), 15000);
    return () => clearInterval(t);
  }, [watching, observe]);
  return (
    <div className="capture-page">
      <SectionHeading title="Bring the real world in" />
      <p className="page-intro">
        Capture a moment. Build a lesson. Practice with context.
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {status && (
        <div className="notice" role="status">
          {status}
        </div>
      )}
      <div className="capture-layout">
        <section>
          <div className={"camera-stage " + (stream ? "is-live" : "")}>
            <video
              ref={video}
              autoPlay
              muted
              playsInline
              onClick={() => void video.current?.play()}
              aria-label="Camera preview"
            />
            {!stream && (
              <div className="camera-placeholder">
                <div className="scan-target">
                  <ScanLine size={58} />
                </div>
                <span className="eyebrow">CAPTURE / 01</span>
                <h2>
                  Your world.
                  <br />
                  In focus.
                </h2>
                <p>
                  Connect your phone camera or a browser-compatible USB camera.
                </p>
                <button
                  disabled={starting}
                  className="primary"
                  onClick={() => void start()}
                >
                  <Camera size={18} />
                  {starting ? "Opening camera…" : "Enable camera"}
                </button>
              </div>
            )}
            {stream && (
              <>
                <span className="camera-live">
                  <span className="status-pip" />
                  {watching ? "GUIDANCE ACTIVE" : "CAMERA PREVIEW · LOCAL ONLY"}
                </span>
                <div className="viewfinder" />
                <button className="camera-stop secondary" onClick={stop}>
                  <Square size={16} />
                  Stop camera
                </button>
              </>
            )}
          </div>
          <div className="capture-controls">
            {!!devices.length && (
              <label>
                Camera
                <select
                  value={device}
                  onChange={(e) => {
                    stop();
                    setDevice(e.target.value);
                  }}
                >
                  <option value="">Automatic / rear camera</option>
                  {devices.map((d, i) => (
                    <option value={d.deviceId} key={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="primary"
              disabled={!stream || busy}
              onClick={() => void snapshot()}
            >
              <Camera size={18} />
              Save photo
            </button>
            {!stream && !!devices.length && (
              <button className="secondary" onClick={() => void start()}>
                Reconnect camera
              </button>
            )}
          </div>
          <div className="source-import">
            <h3>Or import a scan, photo, or recording</h3>
            <label>
              Source title
              <input
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Visitor check-in walkthrough"
              />
            </label>
            <label className="file-pick">
              <Upload size={20} />
              Choose a file or use your phone’s camera
              <input
                aria-label="Capture or import file"
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf,.txt,.md"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="voice-toggle">
              <input
                type="checkbox"
                checked={analyze}
                onChange={(e) => setAnalyze(e.target.checked)}
              />
              Generate a procedure and lesson draft
            </label>
            <p className="muted">
              Analysis sends the file to{" "}
              {config?.provider || "your configured AI provider"}. PDFs up to 10
              MB; photos and video up to 100 MB. Export scanner documents as PDF
              to import here. Video analysis samples frames; audio is not
              transcribed.
            </p>
          </div>
        </section>
        <aside className="guidance-panel">
          <span className="eyebrow">GUIDED PRACTICE / BETA</span>
          <h2>Context, while you work.</h2>
          <p>
            Choose an approved general-operations procedure. AI can flag
            possible visible mismatches, but cannot verify correctness or
            safety.
          </p>
          <label>
            Reviewed procedure
            <select
              value={pid}
              disabled={watching}
              onChange={(e) => {
                request.current?.abort();
                setPid(e.target.value);
                setStep(0);
                setFeedback(null);
              }}
            >
              <option value="">Select a procedure…</option>
              {approved.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          {p && (
            <label>
              Current step
              <select
                value={step}
                disabled={watching}
                onChange={(e) => {
                  request.current?.abort();
                  setStep(Number(e.target.value));
                  setFeedback(null);
                }}
              >
                {p.steps.map((s, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {s}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="privacy-note">
            Start guidance sends one frame every 15 seconds to{" "}
            {config?.provider || "your AI provider"}, up to 20 checks. Frames
            are not saved by this app. Provider retention policies apply. Stop
            or leave this page to end camera access.
          </p>
          <button
            className="primary"
            disabled={!stream || !p?.steps.length || !config?.aiEnabled}
            onClick={() => {
              if (watching) {
                setWatching(false);
                request.current?.abort();
              } else {
                checks.current = 0;
                setWatching(true);
              }
            }}
          >
            {watching ? <Pause size={17} /> : <Play size={17} />}{" "}
            {watching ? "Pause guidance" : "Start guidance"}
          </button>
          <label className="voice-toggle">
            <input
              type="checkbox"
              checked={audio}
              onChange={(e) => {
                setAudio(e.target.checked);
                if (!e.target.checked) window.speechSynthesis?.cancel();
              }}
            />
            Read feedback aloud
          </label>
          {!config?.aiEnabled && (
            <p className="notice">
              AI configuration needed. Capture and file storage work without AI
              credits.
            </p>
          )}
          <section className="feedback" aria-live="polite">
            {feedback ? (
              <>
                <span className="eyebrow">
                  OBSERVATION ·{" "}
                  {new Date(feedback.checkedAt).toLocaleTimeString()}
                </span>
                <p>{feedback.reply}</p>
                {feedback.observations.map((o, i) => (
                  <p key={i}>
                    <Check size={14} /> {o}
                  </p>
                ))}
                {feedback.uncertainties.map((u, i) => (
                  <p className="muted" key={i}>
                    Uncertain: {u}
                  </p>
                ))}
              </>
            ) : (
              <>
                <ScanLine size={28} />
                <p>Observations appear here after you start guidance.</p>
                <small>
                  No background recording. No automatic task completion.
                </small>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
