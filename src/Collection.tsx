import { useEffect, useState, type FormEvent } from "react";
import {
  Cannabis,
  Camera,
  ClipboardList,
  Plus,
  Sprout,
  Package,
  ArrowUpRight,
} from "lucide-react";
import { api, formatDate, type Media } from "./types";
import { Empty, Modal } from "./ui";
import { Garden, type CollectionSection } from "./Garden";

type Entry = {
  id: string;
  observedAt: string;
  notes: string;
  kind: "observation" | "issue";
  mediaId: string | null;
  measurement: number | null;
  status: "open" | "resolved" | null;
  author: string;
  authorId: string;
  version: number;
  resolutionNote: string;
  resolvedAt: string | null;
};
type Specimen = {
  id: string;
  name: string;
  kind: "plant" | "seed" | "material";
  notes: string;
  measurementLabel: string;
  unit: string;
  entryCount: number;
  openIssues: number;
  coverId: string | null;
  observations?: Entry[];
};
const json = (body: unknown, method = "POST") => ({
  method,
  body: JSON.stringify(body),
});
const localNow = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

function MeasurementHistory({
  entries,
  label,
  unit,
}: {
  entries: Entry[];
  label: string;
  unit: string;
}) {
  const points = entries.filter((e) => e.measurement !== null);
  if (!points.length)
    return <p className="muted">No measurements recorded yet.</p>;
  const values = points.map((e) => e.measurement!),
    low = Math.min(...values),
    high = Math.max(...values),
    span = high - low || 1;
  const first = Date.parse(points[0].observedAt),
    last = Date.parse(points.at(-1)!.observedAt),
    duration = last - first || 1;
  const coordinates = points.map((p) => ({
    x: 35 + ((Date.parse(p.observedAt) - first) / duration) * 530,
    y: 140 - ((p.measurement! - low) / span) * 100,
  }));
  return (
    <section className="measurement-history">
      <div className="collection-section-title">
        <h3>{label}</h3>
        <span>
          {points.length} recorded measurements · {unit}
        </span>
      </div>
      <svg
        viewBox="0 0 600 180"
        role="img"
        aria-label={`${label}: ${points.length} recorded values. Detailed values follow below.`}
      >
        <line
          x1="35"
          y1="150"
          x2="565"
          y2="150"
          stroke="currentColor"
          opacity=".3"
        />
        <polyline
          points={coordinates.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--lime)"
          strokeWidth="2"
        />
        {coordinates.map((p, i) => (
          <circle key={points[i].id} cx={p.x} cy={p.y} r="4" fill="var(--lime)">
            <title>
              {formatDate(points[i].observedAt)}: {points[i].measurement} {unit}
            </title>
          </circle>
        ))}
        <text x="35" y="174" fill="currentColor" fontSize="11">
          {formatDate(points[0].observedAt)}
        </text>
        <text
          x="565"
          y="174"
          textAnchor="end"
          fill="currentColor"
          fontSize="11"
        >
          {formatDate(points.at(-1)!.observedAt)}
        </text>
      </svg>
      <p className="muted">
        Your recorded values only. No predicted growth or inferred measurements.
      </p>
      <div className="record-totals">
        <span>
          Latest{" "}
          <strong>
            {values.at(-1)} {unit}
          </strong>
        </span>
        <span>
          Recorded change{" "}
          <strong>
            {Number(
              (values.at(-1)! - values[0]).toPrecision(10),
            ).toLocaleString(undefined, {
              maximumFractionDigits: 6,
              signDisplay: "exceptZero",
            })}{" "}
            {unit}
          </strong>
        </span>
      </div>
      <details>
        <summary>View measurement history</summary>
        <table>
          <thead>
            <tr>
              <th>Observed</th>
              <th>
                {label} ({unit})
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.observedAt).toLocaleString()}</td>
                <td>{p.measurement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export function Collection({
  root,
  media,
  userId,
  canReview,
  onUploaded,
}: {
  root: string;
  media: Media[];
  userId: string;
  canReview: boolean;
  onUploaded: () => void;
}) {
  const [section, setSection] = useState<CollectionSection>(() => {
    const saved = sessionStorage.getItem(`collection-section:${root}`);
    return saved === "areas" || saved === "tasks" || saved === "materials"
      ? saved
      : "records";
  });
  function changeSection(next: CollectionSection) {
    setSection(next);
    sessionStorage.setItem(`collection-section:${root}`, next);
  }
  const [profiles, setProfiles] = useState<Specimen[]>([]),
    [selected, setSelected] = useState(""),
    [detail, setDetail] = useState<Specimen | null>(null),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [create, setCreate] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [attached, setAttached] = useState(""),
    [left, setLeft] = useState(""),
    [right, setRight] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setDetail(null);
    void Promise.all([
      api<Specimen[]>(root + "/specimens", { signal: c.signal }),
      selected
        ? api<Specimen>(root + `/specimens/${selected}`, { signal: c.signal })
        : Promise.resolve(null),
    ])
      .then(([list, item]) => {
        if (c.signal.aborted) return;
        setProfiles(list);
        setDetail(item);
        if (!selected && list.length) setSelected(list[0].id);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [root, selected, revision]);
  function select(id: string) {
    setSelected(id);
    setFile(null);
    setAttached("");
    setLeft("");
    setRight("");
    setError("");
    setMessage("");
  }
  async function createProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const p = await api<Specimen>(
        root + "/specimens",
        json(Object.fromEntries(form)),
      );
      setCreate(false);
      select(p.id);
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addEntry(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!detail || busy) return;
    const formElement = e.currentTarget,
      form = new FormData(formElement);
    setBusy(true);
    setError("");
    setMessage("");
    let mediaId = attached || null;
    try {
      if (file && !attached) {
        const upload = new FormData();
        upload.set("file", file);
        upload.set(
          "title",
          `${detail.name} · ${String(form.get("observedAt"))}`,
        );
        upload.set("analyze", "false");
        const m = await api<Media>(root + "/media", {
          method: "POST",
          body: upload,
        });
        mediaId = m.id;
        setAttached(m.id);
        onUploaded();
      }
      await api(
        root + `/specimens/${detail.id}/observations`,
        json({
          notes: form.get("notes"),
          kind: form.get("kind"),
          observedAt: new Date(String(form.get("observedAt"))).toISOString(),
          mediaId,
          measurement: form.get("measurement")
            ? Number(form.get("measurement"))
            : null,
        }),
      );
      formElement.reset();
      setFile(null);
      setAttached("");
      setRevision((v) => v + 1);
      setMessage("Observation saved. Your lesson progress has not changed.");
    } catch (e) {
      setError(
        (e as Error).message +
          (mediaId
            ? " Your image is saved in the media library; retry to attach it to this record."
            : ""),
      );
    } finally {
      setBusy(false);
    }
  }
  async function updateIssue(e: FormEvent<HTMLFormElement>, entry: Entry) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(
        root + `/observations/${entry.id}`,
        json(
          {
            status: entry.status === "open" ? "resolved" : "open",
            version: entry.version,
            resolutionNote: form.get("resolutionNote"),
          },
          "PATCH",
        ),
      );
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
      setRevision((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }
  const entries = detail?.observations || [],
    photos = entries.filter((e) => e.mediaId),
    images = media.filter((m) => m.mime.startsWith("image/"));
  const photoUrl = (id: string) => `/api${root}/media/${id}/file`;
  const comparison = [
    photos.find((p) => p.id === left) || photos[0],
    photos.find((p) => p.id === right) || photos.at(-1),
  ];
  return (
    <div className="collection-page">
      <header className="collection-header">
        <div>
          <h1>Your collection, connected.</h1>
          <p>
            Plants, places, and everything on hand. Keep your records, layout,
            reminders and materials together, separate from lessons.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            changeSection("records");
            setCreate(true);
            setError("");
          }}
        >
          <Plus size={18} />
          Add to collection
        </button>
      </header>
      <nav className="collection-sections" aria-label="Collection sections">
        {(["records", "areas", "tasks", "materials"] as const).map((s) => (
          <button
            key={s}
            aria-current={section === s ? "page" : undefined}
            disabled={busy}
            onClick={() => changeSection(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </nav>
      {section !== "records" && (
        <Garden
          root={root}
          userId={userId}
          section={section}
          profiles={profiles}
          onOpen={(id) => {
            select(id);
            changeSection("records");
          }}
        />
      )}
      <div hidden={section !== "records"}>
        {error && !create && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {!profiles.length && !loading ? (
          <Empty
            title="Start with what’s in front of you"
            action={
              <button className="primary" onClick={() => setCreate(true)}>
                Create your first record
              </button>
            }
          >
            Give a plant, seed lot, or material a name. Add photos and
            observations as time passes.
          </Empty>
        ) : (
          <div className="collection-layout">
            <aside className="collection-index">
              <h2>
                My collection <small>{profiles.length}</small>
              </h2>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  disabled={busy}
                  className={selected === p.id ? "selected" : ""}
                  onClick={() => select(p.id)}
                >
                  {p.coverId ? (
                    <img src={photoUrl(p.coverId)} alt="" />
                  ) : p.kind === "plant" ? (
                    <Cannabis />
                  ) : p.kind === "seed" ? (
                    <Sprout />
                  ) : (
                    <Package />
                  )}
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.kind} · {p.entryCount} records
                      {p.openIssues ? ` · ${p.openIssues} open issues` : ""}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </aside>
            <div className="collection-detail">
              {loading ? (
                <p role="status">Loading your records…</p>
              ) : detail ? (
                <>
                  <header className="specimen-header">
                    <span className="specimen-kind">{detail.kind} record</span>
                    <h2>{detail.name}</h2>
                    <p className="preserve">{detail.notes}</p>
                    <div className="record-totals">
                      <span>
                        <strong>{entries.length}</strong> observations
                      </span>
                      <span>
                        <strong>{photos.length}</strong> photos
                      </span>
                      <span>
                        <strong>
                          {entries.filter((e) => e.status === "open").length}
                        </strong>{" "}
                        open issues
                      </span>
                    </div>
                  </header>
                  {photos.length >= 2 && (
                    <section className="photo-comparison">
                      <h3>Compare your photos</h3>
                      <div>
                        {comparison.map((entry, i) => (
                          <figure key={i}>
                            <label>
                              {i === 0
                                ? "First comparison photo"
                                : "Second comparison photo"}
                              <select
                                value={entry?.id || ""}
                                onChange={(e) =>
                                  (i === 0 ? setLeft : setRight)(e.target.value)
                                }
                              >
                                {photos.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {new Date(p.observedAt).toLocaleString()} ·{" "}
                                    {p.notes.slice(0, 30)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <a
                              href={photoUrl(entry!.mediaId!)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={photoUrl(entry!.mediaId!)}
                                alt={`Recorded on ${formatDate(entry!.observedAt)}: ${entry!.notes}`}
                              />
                            </a>
                            <figcaption>
                              {formatDate(entry!.observedAt)}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </section>
                  )}
                  {detail.measurementLabel && (
                    <MeasurementHistory
                      entries={entries}
                      label={detail.measurementLabel}
                      unit={detail.unit}
                    />
                  )}
                  <section className="observation-form">
                    <h3>Add an observation</h3>
                    <p>
                      Record facts, attach a photo, or log an issue for review.
                      These records do not generate lessons or diagnoses.
                    </p>
                    <form key={detail.id} onSubmit={(e) => void addEntry(e)}>
                      <fieldset disabled={busy}>
                        <div className="form-pair">
                          <label>
                            Observed at
                            <input
                              type="datetime-local"
                              name="observedAt"
                              defaultValue={localNow()}
                              required
                            />
                          </label>
                          <label>
                            Record type
                            <select name="kind">
                              <option value="observation">Observation</option>
                              <option value="issue">Issue to review</option>
                            </select>
                          </label>
                        </div>
                        <label>
                          Observation notes
                          <textarea
                            name="notes"
                            required
                            maxLength={8000}
                            rows={3}
                            placeholder="Describe what you can see or what you measured."
                          />
                        </label>
                        {detail.measurementLabel && (
                          <label>
                            {detail.measurementLabel} ({detail.unit})
                            <input
                              type="number"
                              name="measurement"
                              step="any"
                              min={-1e9}
                              max={1e9}
                              placeholder="Optional recorded value"
                            />
                          </label>
                        )}
                        <div className="form-pair">
                          <label>
                            Take a photo
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              capture="environment"
                              disabled={busy}
                              onChange={(e) => {
                                setFile(e.target.files?.[0] || null);
                                setAttached("");
                              }}
                            />
                          </label>
                          <label>
                            Upload a photo
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              disabled={busy}
                              onChange={(e) => {
                                setFile(e.target.files?.[0] || null);
                                setAttached("");
                              }}
                            />
                          </label>
                        </div>
                        {file && <p className="muted">Selected: {file.name}</p>}
                        <label>
                          Or attach an existing image
                          <select
                            value={attached}
                            disabled={busy}
                            onChange={(e) => {
                              setAttached(e.target.value);
                              setFile(null);
                            }}
                          >
                            <option value="">No existing image selected</option>
                            {images.map((m) => (
                              <option value={m.id} key={m.id}>
                                {m.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button className="primary" disabled={busy}>
                          <Camera size={17} />
                          {busy ? "Saving…" : "Save observation"}
                        </button>
                        <small>
                          Photos stay in your workspace. Collection uploads are
                          stored without AI analysis.
                        </small>
                      </fieldset>
                    </form>
                  </section>
                  <section className="observation-timeline">
                    <div className="collection-section-title">
                      <h3>Observation timeline</h3>
                      <span>Newest first</span>
                    </div>
                    {!entries.length ? (
                      <Empty title="A timeline starts with one observation">
                        Save a dated note or photo above.
                      </Empty>
                    ) : (
                      [...entries].reverse().map((entry) => (
                        <article key={entry.id}>
                          <header>
                            <time dateTime={entry.observedAt}>
                              {new Date(entry.observedAt).toLocaleString()}
                            </time>
                            <span
                              className={
                                "record-status " + (entry.status || "")
                              }
                            >
                              {entry.status === "open"
                                ? "Open issue"
                                : entry.status === "resolved"
                                  ? "Resolved issue"
                                  : "Observation"}
                            </span>
                          </header>
                          <p className="preserve">{entry.notes}</p>
                          {entry.measurement !== null && (
                            <p className="record-measurement">
                              {detail.measurementLabel}:{" "}
                              <strong>
                                {entry.measurement} {detail.unit}
                              </strong>
                            </p>
                          )}
                          {entry.mediaId && (
                            <a
                              href={photoUrl(entry.mediaId)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                className="observation-photo"
                                src={photoUrl(entry.mediaId)}
                                alt={`Photo for ${entry.notes}`}
                              />
                            </a>
                          )}
                          <small>Recorded by {entry.author}</small>
                          {entry.kind === "issue" && (
                            <>
                              {entry.resolvedAt && (
                                <p className="muted">
                                  Marked resolved {formatDate(entry.resolvedAt)}
                                  {entry.resolutionNote
                                    ? ` · ${entry.resolutionNote}`
                                    : ""}
                                </p>
                              )}
                              {(canReview || entry.authorId === userId) && (
                                <form
                                  onSubmit={(e) => void updateIssue(e, entry)}
                                >
                                  <fieldset disabled={busy}>
                                    <label>
                                      Review note
                                      <input
                                        name="resolutionNote"
                                        defaultValue={entry.resolutionNote}
                                        maxLength={4000}
                                        placeholder="Record your review or follow-up."
                                      />
                                    </label>
                                    <button
                                      className="secondary"
                                      disabled={busy}
                                    >
                                      <ClipboardList size={16} />
                                      {entry.status === "open"
                                        ? "Mark issue resolved"
                                        : "Reopen issue"}
                                    </button>
                                  </fieldset>
                                </form>
                              )}
                            </>
                          )}
                        </article>
                      ))
                    )}
                  </section>
                </>
              ) : (
                <Empty title="Choose a record">
                  Select an item from your collection to see its history.
                </Empty>
              )}
            </div>
          </div>
        )}
        {create && (
          <Modal
            title="Add to your collection"
            close={() => {
              if (!busy) setCreate(false);
            }}
          >
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <form onSubmit={(e) => void createProfile(e)}>
              <fieldset disabled={busy}>
                <label>
                  Record name
                  <input
                    name="name"
                    required
                    maxLength={200}
                    placeholder="e.g. Plant A or seed lot 01"
                  />
                </label>
                <label>
                  Collection type
                  <select name="kind">
                    <option value="plant">Plant</option>
                    <option value="seed">Seed lot</option>
                    <option value="material">Material</option>
                  </select>
                </label>
                <label>
                  Profile notes
                  <textarea name="notes" maxLength={4000} rows={3} />
                </label>
                <p className="muted">
                  Optionally track one numeric measurement consistently for this
                  record.
                </p>
                <div className="form-pair">
                  <label>
                    Measurement label
                    <input
                      name="measurementLabel"
                      maxLength={80}
                      placeholder="e.g. Recorded dimension"
                    />
                  </label>
                  <label>
                    Unit
                    <input name="unit" maxLength={30} placeholder="e.g. cm" />
                  </label>
                </div>
                <button className="primary" disabled={busy}>
                  Create record
                </button>
              </fieldset>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
}
