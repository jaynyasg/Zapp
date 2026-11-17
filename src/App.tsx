import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from "react";
import {
  LayoutGrid,
  Images,
  BookOpen,
  NotebookPen,
  Users,
  Activity,
  Settings,
  Upload,
  Plus,
  ArrowRight,
  ArrowUpRight,
  Search,
  LogOut,
  Check,
  FileText,
  Video,
  Image as ImageIcon,
  Clock,
  ShieldCheck,
  Menu,
  Sparkles,
  Download,
  RefreshCw,
  Trash2,
  Leaf,
} from "lucide-react";
import {
  api,
  emptyData,
  formatDate,
  labels,
  type User,
  type Workspace,
  type Data,
  type Config,
  type Media,
  type Procedure,
  type Assignment,
} from "./types";
import { Brand, Badge, Empty, Modal, SectionHeading, Botanical } from "./ui";

const navigation = [
  ["overview", "Overview", LayoutGrid],
  ["media", "Media library", Images],
  ["procedures", "Procedures", BookOpen],
  ["journal", "Journal", NotebookPen],
  ["team", "Team & training", Users],
  ["activity", "Activity", Activity],
] as const;
type Page = (typeof navigation)[number][0] | "settings";
type Dialog = {
  kind:
    | "upload"
    | "workspace"
    | "journal"
    | "member"
    | "assign"
    | "procedure"
    | "media"
    | "assignment";
  id?: string;
  edit?: boolean;
};
const lines = (s: FormDataEntryValue | null) =>
  String(s || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const json = (body: unknown, method = "POST") => ({
  method,
  body: JSON.stringify(body),
});

export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [boot, setBoot] = useState(true),
    [spaces, setSpaces] = useState<Workspace[]>([]),
    [wid, setWid] = useState("");
  const [data, setData] = useState<Data>(emptyData),
    [config, setConfig] = useState<Config | null>(null),
    [page, setPage] = useState<Page>(
      (sessionStorage.getItem("mg-page") as Page) || "overview",
    );
  const [dialog, setDialog] = useState<Dialog | null>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [mobile, setMobile] = useState(false);
  const current = spaces.find((w) => w.id === wid);
  const canEdit = current?.role !== "member";
  const controller = useRef<AbortController | null>(null);
  const root = `/workspaces/${wid}`;
  const loadSpaces = useCallback(async () => {
    const list = await api<Workspace[]>("/workspaces");
    setSpaces(list);
    setWid((old) =>
      list.some((w) => w.id === old)
        ? old
        : list.find((w) => w.id === localStorage.getItem("mg-workspace"))?.id ||
          list[0]?.id ||
          "",
    );
    setConfig(await api<Config>("/config"));
  }, []);
  useEffect(() => {
    api<User>("/auth/me")
      .then(async (u) => {
        setUser(u);
        await loadSpaces();
      })
      .catch(() => {})
      .finally(() => setBoot(false));
  }, [loadSpaces]);
  const reload = useCallback(async () => {
    if (!wid) return;
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    const keys = [
      "media",
      "procedures",
      "journals",
      "members",
      "assignments",
      "audit",
    ] as const;
    const values = await Promise.all(
      keys.map((k) => api(`/workspaces/${wid}/${k}`, { signal: c.signal })),
    );
    if (!c.signal.aborted)
      setData(
        Object.fromEntries(
          keys.map((k, i) => [k, values[i]]),
        ) as unknown as Data,
      );
  }, [wid]);
  useEffect(() => {
    if (!wid) return;
    setData(emptyData);
    setLoading(true);
    localStorage.setItem("mg-workspace", wid);
    reload()
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => controller.current?.abort();
  }, [wid, reload]);
  useEffect(() => {
    if (!data.media.some((m) => ["queued", "processing"].includes(m.status)))
      return;
    const timer = setInterval(() => reload().catch(() => {}), 2500);
    return () => clearInterval(timer);
  }, [data.media, reload]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  function go(p: Page) {
    setPage(p);
    sessionStorage.setItem("mg-page", p);
    setQuery("");
    setFilter("all");
    setMobile(false);
    setError("");
  }
  function open(d: Dialog) {
    setError("");
    setDialog(d);
  }
  async function act(
    fn: () => Promise<unknown>,
    message = "Saved",
    close = true,
    refresh = true,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      if (refresh) await reload();
      if (close) setDialog(null);
      setToast(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function authenticated(u: User) {
    setUser(u);
    await loadSpaces();
  }
  const matches = (v: { title: string }) =>
    v.title.toLowerCase().includes(query.toLowerCase());
  const procedure = dialog?.id
    ? data.procedures.find((p) => p.id === dialog.id)
    : undefined;
  const media = dialog?.id
    ? data.media.find((m) => m.id === dialog.id)
    : undefined;
  const assignment = dialog?.id
    ? data.assignments.find((a) => a.id === dialog.id)
    : undefined;
  const complete = data.assignments.filter((a) => a.completedAt).length;
  const reviewing = data.procedures.filter((p) => p.status === "review");
  const fileURL = (m: Media) => `/api${root}/media/${m.id}/file`;
  function mediaCard(m: Media) {
    return (
      <button
        className="media-card"
        key={m.id}
        onClick={() => open({ kind: "media", id: m.id })}
      >
        <div
          className={
            "media-preview " +
            (m.mime.startsWith("image") ? "" : "preview-document")
          }
        >
          {m.mime.startsWith("image") ? (
            <img src={fileURL(m)} alt="" loading="lazy" />
          ) : m.mime.startsWith("video") ? (
            <>
              <Video size={34} />
              <span>VIDEO</span>
            </>
          ) : (
            <>
              <FileText size={34} />
              <span>DOCUMENT</span>
            </>
          )}
          <span className="file-type">
            {m.mime.split("/")[1].toUpperCase()}
          </span>
        </div>
        <div className="media-card-body">
          <strong>{m.title}</strong>
          <div className="meta">
            {formatDate(m.createdAt)} · {(m.size / 1024 / 1024).toFixed(1)} MB
          </div>
          <Badge status={m.status} />
        </div>
      </button>
    );
  }
  function procedureRow(p: Procedure) {
    return (
      <button
        className="record-row"
        key={p.id}
        onClick={() => open({ kind: "procedure", id: p.id })}
      >
        <span className="record-icon">
          <BookOpen size={20} />
        </span>
        <span className="grow">
          <strong>{p.title}</strong>
          <small>
            Version {p.version} · {p.steps.length} steps · {p.author}
          </small>
        </span>
        <Badge status={p.status} />
        <ArrowUpRight size={17} />
      </button>
    );
  }

  if (boot)
    return (
      <div className="boot">
        <Brand />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!user) return <Auth onAuth={authenticated} />;
  if (!spaces.length)
    return (
      <div className="onboarding">
        <div className="onboarding-brand">
          <Brand />
        </div>
        <section className="onboarding-card">
          <span className="eyebrow">A FRESH START</span>
          <h1>
            A place for
            <br />
            your know-how.
          </h1>
          <p>
            Create your first workspace. Keep personal records in Home, or bring
            your team together in a Facility.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <WorkspaceForm
            busy={busy}
            onSubmit={(b) =>
              act(
                async () => {
                  const w = await api<Workspace>("/workspaces", json(b));
                  await loadSpaces();
                  setWid(w.id);
                },
                "Workspace created",
                true,
                false,
              )
            }
          />
        </section>
        <Botanical />
      </div>
    );
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <Brand />
        <span className="workspace-label">YOUR WORKSPACE</span>
        <label className="sr-only" htmlFor="workspace-switch">
          Switch workspace
        </label>
        <select
          id="workspace-switch"
          value={wid}
          onChange={(e) => {
            setWid(e.target.value);
            setDialog(null);
            setMobile(false);
          }}
        >
          {spaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} · {w.kind === "home" ? "Home" : "SOP"}
            </option>
          ))}
        </select>
        <button
          className="sidebar-new"
          onClick={() => open({ kind: "workspace" })}
        >
          <Plus size={14} /> New workspace
        </button>
        <nav aria-label="Main navigation">
          {navigation.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => go(id)}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "procedures" && reviewing.length > 0 && (
                <b>{reviewing.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Leaf size={20} />
            <p>
              A little more organized.
              <br />A lot more possible.
            </p>
          </div>
          <button
            className={"settings-link " + (page === "settings" ? "active" : "")}
            onClick={() => go("settings")}
          >
            <Settings size={18} /> Workspace settings
          </button>
          <button
            className="profile"
            onClick={() =>
              act(
                async () => {
                  await api("/auth/logout", json({}));
                  setUser(null);
                  setSpaces([]);
                  setWid("");
                  setData(emptyData);
                },
                "Signed out",
                true,
                false,
              )
            }
          >
            <span className="avatar">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="grow">
              <strong>{user.name}</strong>
              <small>{current?.role}</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Toggle navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
            <span>
              {current?.kind === "home" ? "MasterGrow Home" : "MasterGrow SOP"}
            </span>
            <span className="slash">/</span>
            <strong>
              {navigation.find((x) => x[0] === page)?.[1] || "Settings"}
            </strong>
          </div>
          <span className="private-label">
            <ShieldCheck size={15} /> Private workspace
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          {error && !dialog && (
            <div className="error" role="alert">
              {error}
              <button
                className="text-button"
                onClick={() =>
                  reload()
                    .then(() => setError(""))
                    .catch((e) => setError(e.message))
                }
              >
                Retry
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading" role="status">
              Loading your workspace…
            </div>
          ) : (
            <>
              {page === "overview" && (
                <>
                  <section className="hero">
                    <div>
                      <span className="eyebrow">
                        YOUR KNOWLEDGE, TAKING ROOT
                      </span>
                      <h1>
                        Good things grow
                        <br />
                        from good records.
                      </h1>
                      <p>
                        Your media, procedures, and people.
                        <br />
                        One thoughtfully organized workspace.
                      </p>
                      <button
                        className="primary"
                        onClick={() => open({ kind: "upload" })}
                      >
                        <Upload size={17} /> Upload media{" "}
                        <ArrowUpRight size={17} />
                      </button>
                    </div>
                    <Botanical />
                  </section>
                  <div className="stats">
                    {[
                      [
                        Images,
                        data.media.length,
                        "Media in your library",
                        "media",
                      ],
                      [
                        BookOpen,
                        data.procedures.filter((p) => p.status === "approved")
                          .length,
                        "Approved procedures",
                        "procedures",
                      ],
                      [ShieldCheck, complete, "Training acknowledged", "team"],
                      [
                        Users,
                        data.members.length,
                        "People in your workspace",
                        "team",
                      ],
                    ].map(([Icon, value, label, destination]) => {
                      const I = Icon as typeof Images;
                      return (
                        <button
                          className="stat"
                          key={String(label)}
                          onClick={() => go(destination as Page)}
                        >
                          <I size={21} />
                          <strong>{String(value).padStart(2, "0")}</strong>
                          <span>{String(label)}</span>
                          <ArrowUpRight size={16} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="overview-grid">
                    <section>
                      <SectionHeading
                        title="Your recent library"
                        action="View library"
                        onClick={() => go("media")}
                      />
                      {data.media.length ? (
                        <div className="media-grid compact">
                          {data.media.slice(0, 3).map(mediaCard)}
                        </div>
                      ) : (
                        <div className="welcome-card">
                          <div className="paper-stack">
                            <FileText size={54} />
                            <span>
                              <ImageIcon size={27} />
                            </span>
                          </div>
                          <div>
                            <span className="eyebrow">
                              START WITH WHAT YOU KNOW
                            </span>
                            <h3>Every good record starts somewhere.</h3>
                            <p>
                              Add a photo, video, or document. Keep it organized
                              and turn general operations content into a draft
                              your team can use.
                            </p>
                            <button
                              className="text-button"
                              onClick={() => open({ kind: "upload" })}
                            >
                              Add your first file <ArrowRight size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </section>
                    <section className="review-panel">
                      <SectionHeading title="Ready for a second look" />
                      {reviewing.length ? (
                        reviewing.slice(0, 4).map(procedureRow)
                      ) : (
                        <div className="review-empty">
                          <span className="check-circle">
                            <Check size={25} />
                          </span>
                          <h3>A clear desk. A fresh start.</h3>
                          <p>
                            Procedures waiting for approval will appear here.
                          </p>
                        </div>
                      )}
                      <div className="review-foot">
                        <span className="dot" /> Human-reviewed. Always.
                      </div>
                    </section>
                  </div>
                  <section className="workflow-strip">
                    <span className="eyebrow">FROM CAPTURE TO CONFIDENCE</span>
                    {[
                      "Capture the source",
                      "Shape a useful draft",
                      "Review together",
                      "Put knowledge to work",
                    ].map((s, i) => (
                      <div key={s}>
                        <span className="step-number">0{i + 1}</span>
                        <span>{s}</span>
                        {i < 3 && <ArrowRight size={17} />}
                      </div>
                    ))}
                  </section>
                </>
              )}
              {page === "media" && (
                <>
                  <PageHeading
                    eyebrow="KEEP THE ORIGINAL"
                    title="Your media library"
                    description="A home for the photos, videos, and documents behind your knowledge."
                    action={
                      <button
                        className="primary"
                        onClick={() => open({ kind: "upload" })}
                      >
                        <Upload size={17} />
                        Upload media
                      </button>
                    }
                  />
                  <Toolbar
                    query={query}
                    setQuery={setQuery}
                    filter={filter}
                    setFilter={setFilter}
                    options={["all", "image", "video", "text"]}
                  />
                  {data.media
                    .filter(matches)
                    .filter(
                      (m) => filter === "all" || m.mime.startsWith(filter),
                    ).length ? (
                    <div className="media-grid">
                      {data.media
                        .filter(matches)
                        .filter(
                          (m) => filter === "all" || m.mime.startsWith(filter),
                        )
                        .map(mediaCard)}
                    </div>
                  ) : (
                    <Empty
                      title={
                        query ? "No matching files" : "Room for your first idea"
                      }
                      action={
                        <button
                          className="secondary"
                          onClick={() => open({ kind: "upload" })}
                        >
                          Choose a file <Plus size={16} />
                        </button>
                      }
                    >
                      Upload pictures, videos, or text documents. Your originals
                      stay private to this workspace.
                    </Empty>
                  )}
                </>
              )}
              {page === "procedures" && (
                <>
                  <PageHeading
                    eyebrow="KNOWLEDGE YOU CAN COME BACK TO"
                    title="The procedure library"
                    description="Source-backed drafts, thoughtful reviews, and a clear record of what changed."
                    action={
                      canEdit && (
                        <button
                          className="primary"
                          onClick={() =>
                            open({ kind: "procedure", edit: true })
                          }
                        >
                          <Plus size={17} />
                          New procedure
                        </button>
                      )
                    }
                  />
                  <Toolbar
                    query={query}
                    setQuery={setQuery}
                    filter={filter}
                    setFilter={setFilter}
                    options={["all", "draft", "review", "approved"]}
                  />
                  <div className="record-list">
                    {data.procedures
                      .filter(matches)
                      .filter((p) => filter === "all" || p.status === filter)
                      .map(procedureRow)}
                  </div>
                  {!data.procedures
                    .filter(matches)
                    .filter((p) => filter === "all" || p.status === filter)
                    .length && (
                    <Empty title="Make your knowledge repeatable">
                      Upload source material to generate a draft, or write a
                      general operations procedure from scratch.
                    </Empty>
                  )}
                </>
              )}
              {page === "journal" && (
                <>
                  <PageHeading
                    eyebrow="THE SMALL DETAILS MATTER"
                    title="Your workspace journal"
                    description="Observations, decisions, and the context worth keeping."
                    action={
                      <button
                        className="primary"
                        onClick={() => open({ kind: "journal" })}
                      >
                        <Plus size={17} />
                        New entry
                      </button>
                    }
                  />
                  <Toolbar query={query} setQuery={setQuery} />
                  <div className="journal-grid">
                    {data.journals.filter(matches).map((j) => (
                      <article className="journal-card" key={j.id}>
                        <span className="eyebrow">
                          {formatDate(j.createdAt)}
                        </span>
                        <h2>{j.title}</h2>
                        <p className="preserve">{j.body}</p>
                        <footer>
                          <span className="avatar small">
                            {j.author.slice(0, 1)}
                          </span>
                          {j.author}
                        </footer>
                      </article>
                    ))}
                  </div>
                  {!data.journals.filter(matches).length && (
                    <Empty title="Leave a note for your future self">
                      Start with a daily observation, a decision, or something
                      you want your team to remember.
                    </Empty>
                  )}
                </>
              )}
              {page === "team" && (
                <>
                  <PageHeading
                    eyebrow="KNOWLEDGE IS BETTER SHARED"
                    title="People & practice"
                    description="Bring people into the workspace and keep a record of what they’ve learned."
                    action={
                      <div className="actions">
                        {current?.role === "owner" && (
                          <button
                            className="secondary"
                            onClick={() => open({ kind: "member" })}
                          >
                            <Plus size={16} />
                            Add member
                          </button>
                        )}
                        {canEdit && (
                          <button
                            className="primary"
                            onClick={() => open({ kind: "assign" })}
                          >
                            Assign training <ArrowUpRight size={16} />
                          </button>
                        )}
                      </div>
                    }
                  />
                  <SectionHeading title="Your people" />
                  <div className="people-grid">
                    {data.members.map((m) => (
                      <div className="person-card" key={m.id}>
                        <span className="avatar">
                          {m.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="grow">
                          <strong>{m.name}</strong>
                          <small>{m.email}</small>
                        </div>
                        <span className="role-label">{m.role}</span>
                      </div>
                    ))}
                  </div>
                  <SectionHeading title="Training records" />
                  <div className="record-list">
                    {data.assignments.map((a) => (
                      <button
                        className="record-row"
                        key={a.id}
                        onClick={() => open({ kind: "assignment", id: a.id })}
                      >
                        <span className="record-icon">
                          {a.completedAt ? <ShieldCheck /> : <Clock />}
                        </span>
                        <span className="grow">
                          <strong>{a.title}</strong>
                          <small>
                            {a.assignee} · Due{" "}
                            {formatDate(a.dueDate + "T12:00:00")}
                          </small>
                        </span>
                        <Badge
                          status={
                            a.completedAt
                              ? "approved"
                              : a.dueDate <
                                  new Date().toISOString().slice(0, 10)
                                ? "Overdue"
                                : "Assigned"
                          }
                        />
                        <ArrowUpRight size={17} />
                      </button>
                    ))}
                  </div>
                  {!data.assignments.length && (
                    <Empty title="Build confidence, one procedure at a time">
                      Approve a procedure, then assign it to a workspace member.
                      Each acknowledgement keeps a copy of the approved version.
                    </Empty>
                  )}
                </>
              )}
              {page === "activity" && (
                <>
                  <PageHeading
                    eyebrow="A RECORD YOU CAN FOLLOW"
                    title="Workspace activity"
                    description="Who changed what, and when. Your shared history, in one place."
                  />
                  <div className="activity-list">
                    {data.audit.map((a) => (
                      <div className="activity-row" key={a.id}>
                        <span className="activity-marker">
                          <Activity size={17} />
                        </span>
                        <div className="grow">
                          <p>
                            <strong>{a.actor}</strong> ·{" "}
                            {a.action.replaceAll(".", " ").replaceAll("_", " ")}
                          </p>
                          <span>{a.target}</span>
                        </div>
                        <time>{new Date(a.created).toLocaleString()}</time>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {page === "settings" && (
                <>
                  <PageHeading
                    eyebrow="MAKE YOURSELF AT HOME"
                    title="Workspace settings"
                    description="The essentials behind your workspace."
                  />
                  <section className="settings-card">
                    <h2>{current?.name}</h2>
                    <dl>
                      <dt>Workspace type</dt>
                      <dd>
                        {current?.kind === "home"
                          ? "MasterGrow Home"
                          : "MasterGrow SOP · Facility"}
                      </dd>
                      <dt>Your access</dt>
                      <dd>{current?.role}</dd>
                      <dt>Signed in as</dt>
                      <dd>{user.email}</dd>
                      <dt>AI provider</dt>
                      <dd>
                        {config?.aiEnabled
                          ? "Anthropic · API key configured"
                          : "Not configured"}
                      </dd>
                      <dt>Media storage</dt>
                      <dd>Private server storage</dd>
                    </dl>
                    <div className="callout">
                      <Sparkles size={20} />
                      <div>
                        <strong>Source material → useful drafts</strong>
                        <p>
                          {config?.aiEnabled
                            ? "AI processing is available for uploads you choose to analyze."
                            : "Set ANTHROPIC_API_KEY in the server environment and restart to enable processing."}{" "}
                          Generated materials need a human review. Video
                          analysis samples visual frames; it does not listen to
                          audio.
                        </p>
                      </div>
                    </div>
                    <p className="muted">
                      General operations and recordkeeping materials are
                      supported. Cultivation instructions and coaching are
                      outside the analysis scope.
                    </p>
                    <button
                      className="secondary"
                      onClick={() => open({ kind: "workspace" })}
                    >
                      <Plus size={16} />
                      Create another workspace
                    </button>
                  </section>
                </>
              )}
            </>
          )}
          <footer className="app-footer">
            <span>MasterGrow · A place for your know-how.</span>
            <span>Made for the way you work.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {dialog && (
        <Modal
          title={
            {
              upload: "Add to your library",
              workspace: "A new workspace",
              journal: "A note worth keeping",
              member: "Bring someone in",
              assign: "Assign a procedure",
              procedure: dialog.edit
                ? "Shape your procedure"
                : "Procedure details",
              media: "Source material",
              assignment: "Your training record",
            }[dialog.kind]
          }
          close={() => {
            if (!busy) setDialog(null);
          }}
        >
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {dialog.kind === "workspace" && (
            <WorkspaceForm
              busy={busy}
              onSubmit={(b) =>
                act(
                  async () => {
                    const w = await api<Workspace>("/workspaces", json(b));
                    await loadSpaces();
                    setWid(w.id);
                  },
                  "Workspace created",
                  true,
                  false,
                )
              }
            />
          )}
          {dialog.kind === "upload" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                f.set("analyze", f.get("analyze") ? "true" : "false");
                act(
                  () => api(`${root}/media`, { method: "POST", body: f }),
                  "File added to your library",
                );
              }}
            >
              <label className="upload-zone">
                <Upload size={30} />
                <strong>Give your knowledge a home</strong>
                <span>JPG, PNG, WebP, MP4, WebM, TXT or MD · up to 100 MB</span>
                <span>
                  Videos: up to 10 minutes for analysis. Text: up to 1 MB.
                </span>
                <span className="file-label">Choose file</span>
                <input
                  aria-label="Choose file"
                  name="file"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.txt,.md"
                  required
                />
              </label>
              <Field label="Title" name="title" required maxLength={200} />
              <label className="check-label">
                <input type="checkbox" name="analyze" defaultChecked />
                <span>
                  <strong>Turn this into a useful draft</strong>
                  <small>
                    Send this content to Anthropic for a summary, evidenced
                    checklist, and knowledge questions. Review before using.
                    Video audio is not analyzed.
                  </small>
                </span>
              </label>
              {!config?.aiEnabled && (
                <p className="callout">
                  Your file will be saved. Analysis will wait until AI is
                  configured in server settings.
                </p>
              )}
              <FormFooter busy={busy} label="Upload file" />
            </form>
          )}
          {dialog.kind === "journal" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                act(
                  () => api(`${root}/journals`, json(Object.fromEntries(f))),
                  "Journal entry saved",
                );
              }}
            >
              <Field label="Title" name="title" required maxLength={200} />
              <label>
                Notes
                <textarea
                  name="body"
                  required
                  rows={7}
                  maxLength={20000}
                  placeholder="What happened? What’s worth remembering?"
                />
              </label>
              <FormFooter busy={busy} label="Save entry" />
            </form>
          )}
          {dialog.kind === "member" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(
                  () =>
                    api(
                      `${root}/members`,
                      json(Object.fromEntries(new FormData(e.currentTarget))),
                    ),
                  "Member added",
                );
              }}
            >
              <p>
                Add someone who already has a MasterGrow account. Their other
                workspaces stay private.
              </p>
              <Field label="Email address" name="email" type="email" required />
              <label>
                Workspace role
                <select name="role">
                  <option value="member">
                    Member · upload, journal, acknowledge training
                  </option>
                  <option value="reviewer">
                    Reviewer · also edit drafts and assign training
                  </option>
                </select>
              </label>
              <FormFooter busy={busy} label="Add member" />
            </form>
          )}
          {dialog.kind === "assign" &&
            (data.procedures.some((p) => p.status === "approved") ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act(
                    () =>
                      api(
                        `${root}/assignments`,
                        json(Object.fromEntries(new FormData(e.currentTarget))),
                      ),
                    "Training assigned",
                  );
                }}
              >
                <label>
                  Approved procedure
                  <select name="procedureId">
                    {data.procedures
                      .filter((p) => p.status === "approved")
                      .map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.title} · v{p.version}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Assign to
                  <select name="userId">
                    {data.members.map((m) => (
                      <option value={m.id} key={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field label="Due date" name="dueDate" type="date" required />
                <FormFooter busy={busy} label="Assign training" />
              </form>
            ) : (
              <Empty title="Approve a procedure first">
                Training uses a fixed copy of an approved procedure. Create and
                review one in the procedure library.
              </Empty>
            ))}
          {dialog.kind === "procedure" &&
            (dialog.edit ? (
              <form
                key={procedure?.id || "new"}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const b = {
                    title: f.get("title"),
                    summary: f.get("summary"),
                    steps: lines(f.get("steps")),
                    questions: lines(f.get("questions")),
                    gaps: lines(f.get("gaps")),
                    version: procedure?.version,
                  };
                  act(
                    () =>
                      api(
                        `${root}/procedures${procedure ? "/" + procedure.id : ""}`,
                        json(b, procedure ? "PATCH" : "POST"),
                      ),
                    "Draft saved",
                  );
                }}
              >
                <Field
                  label="Title"
                  name="title"
                  defaultValue={procedure?.title}
                  required
                  maxLength={200}
                />
                <label>
                  Summary
                  <textarea
                    name="summary"
                    defaultValue={procedure?.summary}
                    rows={3}
                  />
                </label>
                <label>
                  Checklist — one step per line
                  <textarea
                    name="steps"
                    defaultValue={procedure?.steps.join("\n")}
                    rows={6}
                  />
                </label>
                <label>
                  Knowledge questions — one per line
                  <textarea
                    name="questions"
                    defaultValue={procedure?.questions.join("\n")}
                    rows={3}
                  />
                </label>
                <label>
                  Evidence gaps — one per line
                  <textarea
                    name="gaps"
                    defaultValue={procedure?.gaps.join("\n")}
                    rows={3}
                  />
                </label>
                <FormFooter busy={busy} label="Save draft" />
              </form>
            ) : (
              procedure && (
                <>
                  <ProcedureBody p={procedure} />
                  {procedure.sourceId && (
                    <button
                      className="text-button"
                      onClick={() =>
                        open({ kind: "media", id: procedure.sourceId })
                      }
                    >
                      <Images size={16} />
                      View original source
                    </button>
                  )}
                  <div className="dialog-actions">
                    <a
                      className="secondary"
                      href={`/api${root}/procedures/${procedure.id}/export`}
                    >
                      <Download size={16} />
                      Export Markdown
                    </a>
                    {canEdit && procedure.status === "draft" && (
                      <>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => setDialog({ ...dialog, edit: true })}
                        >
                          Edit draft
                        </button>
                        <button
                          className="primary"
                          disabled={busy || !procedure.steps.length}
                          onClick={() =>
                            act(
                              () =>
                                api(
                                  `${root}/procedures/${procedure.id}/submit`,
                                  json({ version: procedure.version }),
                                ),
                              "Submitted for review",
                              false,
                            )
                          }
                        >
                          Submit for review
                        </button>
                      </>
                    )}
                    {canEdit && procedure.status === "review" && (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              api(
                                `${root}/procedures/${procedure.id}/return`,
                                json({ version: procedure.version }),
                              ),
                            "Returned to draft",
                            false,
                          )
                        }
                      >
                        Return to draft
                      </button>
                    )}
                    {current?.role === "owner" &&
                      procedure.status === "review" && (
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () =>
                                api(
                                  `${root}/procedures/${procedure.id}/approve`,
                                  json({ version: procedure.version }),
                                ),
                              "Procedure approved",
                              false,
                            )
                          }
                        >
                          Approve procedure
                        </button>
                      )}
                    {canEdit && procedure.status === "approved" && (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              api(
                                `${root}/procedures/${procedure.id}/revise`,
                                json({ version: procedure.version }),
                              ),
                            "New revision created",
                          )
                        }
                      >
                        Create revision
                      </button>
                    )}
                  </div>
                </>
              )
            ))}
          {dialog.kind === "media" && media && (
            <>
              <div className="media-detail-preview">
                {media.mime.startsWith("image") ? (
                  <img src={fileURL(media)} alt={media.title} />
                ) : media.mime.startsWith("video") ? (
                  <video src={fileURL(media)} controls preload="metadata" />
                ) : (
                  <FileText size={64} />
                )}
              </div>
              <h2>{media.title}</h2>
              <div className="detail-meta">
                <Badge status={media.status} />
                <span>
                  {media.filename} · {(media.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
              <p className="muted">
                Uploaded by {media.uploadedBy} on {formatDate(media.createdAt)}
              </p>
              {media.processingError && (
                <div className="callout">{media.processingError}</div>
              )}
              {media.mime.startsWith("video") && (
                <p className="callout">
                  Analysis uses sampled visual frames. Audio and actions between
                  frames are not analyzed.
                </p>
              )}
              {media.status === "waiting_configuration" && (
                <p className="callout">
                  The original is safely stored. Configure AI on the server,
                  then choose Analyze source.
                </p>
              )}
              <div className="dialog-actions">
                <a
                  className="secondary"
                  href={fileURL(media)}
                  download={media.filename}
                >
                  <Download size={16} />
                  Open original
                </a>
                {media.procedureId ? (
                  <button
                    className="primary"
                    onClick={() =>
                      open({ kind: "procedure", id: media.procedureId })
                    }
                  >
                    Review generated draft <ArrowRight size={16} />
                  </button>
                ) : (
                  !["queued", "processing"].includes(media.status) && (
                    <button
                      className="primary"
                      disabled={busy || !config?.aiEnabled}
                      onClick={() =>
                        act(
                          () =>
                            api(`${root}/media/${media.id}/retry`, json({})),
                          "Analysis queued",
                          false,
                        )
                      }
                    >
                      <Sparkles size={16} />
                      Analyze source
                    </button>
                  )
                )}
                {current?.role === "owner" &&
                  !media.procedureId &&
                  !["queued", "processing"].includes(media.status) && (
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm("Permanently delete this source file?")
                        )
                          act(
                            () =>
                              api(`${root}/media/${media.id}`, {
                                method: "DELETE",
                              }),
                            "File deleted",
                          );
                      }}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  )}
              </div>
            </>
          )}
          {dialog.kind === "assignment" && assignment && (
            <>
              <p className="callout">
                Assigned to {assignment.assignee} · Due{" "}
                {formatDate(assignment.dueDate + "T12:00:00")}. This is the
                approved version saved at assignment.
              </p>
              <ProcedureBody p={assignment.snapshot} />
              {assignment.completedAt ? (
                <p className="success">
                  <ShieldCheck size={18} />
                  Acknowledged on {formatDate(assignment.completedAt)}
                </p>
              ) : (
                assignment.userId === user.id && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          api(
                            `${root}/assignments/${assignment.id}/complete`,
                            json({}),
                          ),
                        "Training acknowledged",
                      )
                    }
                  >
                    I have read and understood this procedure{" "}
                    <Check size={17} />
                  </button>
                )
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </section>
  );
}
function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      {label}
      <input {...props} />
    </label>
  );
}
function FormFooter({ busy, label }: { busy: boolean; label: string }) {
  return (
    <div className="form-footer">
      <button className="primary" disabled={busy} type="submit">
        {busy ? (
          <>
            <RefreshCw size={17} className="spin" />
            Working…
          </>
        ) : (
          <>
            {label}
            <ArrowRight size={17} />
          </>
        )}
      </button>
    </div>
  );
}
function WorkspaceForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (b: unknown) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <Field
        label="Workspace name"
        name="name"
        placeholder="e.g. My home studio"
        required
        maxLength={200}
      />
      <label>
        Workspace type
        <select name="kind">
          <option value="home">Home · your personal knowledge space</option>
          <option value="facility">
            Facility · shared records and team training
          </option>
        </select>
      </label>
      <FormFooter busy={busy} label="Create workspace" />
    </form>
  );
}
function Toolbar({
  query,
  setQuery,
  filter,
  setFilter,
  options,
}: {
  query: string;
  setQuery: (s: string) => void;
  filter?: string;
  setFilter?: (s: string) => void;
  options?: string[];
}) {
  return (
    <div className="toolbar">
      <label className="search-box">
        <Search size={17} />
        <input
          aria-label="Search records"
          placeholder="Find something in your workspace…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {options && (
        <div className="filters" aria-label="Filter records">
          {options.map((o) => (
            <button
              className={filter === o ? "selected" : ""}
              key={o}
              aria-pressed={filter === o}
              onClick={() => setFilter?.(o)}
            >
              {labels[o] || o[0].toUpperCase() + o.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function ProcedureBody({ p }: { p: Procedure }) {
  return (
    <article className="procedure-body">
      <div className="detail-meta">
        <Badge status={p.status} />
        <span>
          Version {p.version} · {p.author}
        </span>
      </div>
      <h2>{p.title}</h2>
      <p className="preserve">{p.summary}</p>
      {p.approvedBy && <p className="muted">Approved by {p.approvedBy}</p>}
      <h3>Checklist</h3>
      {p.steps.length ? (
        <ol className="checklist">
          {p.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      ) : (
        <p>No steps established. Add more source evidence before submitting.</p>
      )}
      {p.questions.length > 0 && (
        <>
          <h3>Knowledge check</h3>
          <ul>
            {p.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </>
      )}
      {p.gaps.length > 0 && (
        <div className="evidence-gaps">
          <h3>Before you put this into practice</h3>
          <ul>
            {p.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
function Auth({ onAuth }: { onAuth: (u: User) => Promise<void> }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const b = Object.fromEntries(new FormData(e.currentTarget));
      const u = await api<User>(
        "/auth/" + (register ? "register" : "login"),
        json(b),
      );
      await onAuth(u);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <span className="eyebrow">LESS SCATTERED. MORE CONNECTED.</span>
          <h1>
            Your knowledge.
            <br />
            Room to grow.
          </h1>
          <p>
            A home for your source material.
            <br />A shared understanding for your team.
          </p>
          <Botanical />
        </div>
        <span className="auth-footer">CAPTURE · ORGANIZE · LEARN</span>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <span className="eyebrow">WELCOME TO MASTERGROW</span>
          <h2>
            {register ? "Make room for what’s next." : "Good to have you here."}
          </h2>
          <p>
            {register
              ? "Start your own workspace. Bring your knowledge together."
              : "Sign in to pick up where you left off."}
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <form onSubmit={submit}>
            {register && (
              <Field
                label="Your name"
                name="name"
                autoComplete="name"
                required
                maxLength={200}
              />
            )}
            <Field
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={register ? 12 : 1}
              maxLength={128}
            />
            {register && (
              <small className="muted">Use at least 12 characters.</small>
            )}
            <FormFooter
              busy={busy}
              label={register ? "Create account" : "Sign in"}
            />
          </form>
          <div className="auth-switch">
            {register ? "Already have an account?" : "New to MasterGrow?"}{" "}
            <button
              className="text-button"
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Sign in instead" : "Create an account"}
            </button>
          </div>
          <p className="auth-privacy">
            <ShieldCheck size={17} /> Your workspace stays private to the people
            you choose.
          </p>
        </div>
      </section>
    </div>
  );
}
