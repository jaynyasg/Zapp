import { useEffect, useState, type FormEvent } from "react";
import {
  Bell,
  Grid2X2,
  Package,
  Plus,
  Sprout,
  ArrowUpRight,
} from "lucide-react";
import { api } from "./types";
import { Empty, Modal } from "./ui";

export type CollectionSection = "records" | "areas" | "tasks" | "materials";
type Profile = { id: string; name: string; kind: string };
type Area = {
  id: string;
  name: string;
  rows: number;
  columns: number;
  notes: string;
  version: number;
};
type Placement = {
  id: string;
  specimenId: string;
  areaId: string | null;
  row: number | null;
  column: number | null;
  version: number;
};
type Task = {
  id: string;
  title: string;
  notes: string;
  specimenId: string | null;
  areaId: string | null;
  dueAt: string;
  status: "pending" | "completed" | "cancelled";
  version: number;
  completedAt: string | null;
};
type Supply = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  reorderAt: number;
  targetQuantity: number;
  specimenId: string | null;
  notes: string;
  version: number;
  suggestedQuantity?: number;
};
type Adjustment = {
  id: string;
  supplyId: string;
  delta: number;
  note: string;
  quantity: number;
  author: string;
  createdAt: string;
};
type Snapshot = {
  areas: Area[];
  placements: Placement[];
  tasks: Task[];
  supplies: Supply[];
  adjustments: Adjustment[];
  dueTasks: Task[];
  restock: Supply[];
};
const json = (body: unknown, method = "POST") => ({
  method,
  body: JSON.stringify(body),
});
const changed = () => window.dispatchEvent(new Event("collection-changed"));
const localDate = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const dateLabel = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
const preferenceKey = (root: string, userId: string) =>
  `collection-notify:${userId}:${root}`;

export function CollectionReminders({
  root,
  userId,
  onOpen,
}: {
  root: string;
  userId: string;
  onOpen: () => void;
}) {
  const [state, setState] = useState<Snapshot | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    let active = false;
    async function poll() {
      if (active) return;
      active = true;
      try {
        const next = await api<Snapshot>(root + "/garden", {
          signal: c.signal,
        });
        if (c.signal.aborted) return;
        setState(next);
        setError("");
        if (
          "Notification" in window &&
          Notification.permission === "granted" &&
          localStorage.getItem(preferenceKey(root, userId)) === "on"
        ) {
          const key = `${preferenceKey(root, userId)}:seen`;
          const seen: string[] = JSON.parse(localStorage.getItem(key) || "[]");
          const unseen = next.dueTasks.filter(
            (t) => !seen.includes(`${t.id}:${t.dueAt}`),
          );
          if (unseen.length) {
            try {
              new Notification("MasterGrow collection reminder", {
                body: `${next.dueTasks.length} task(s) due. Open My collection to review.`,
                tag: "mastergrow-collection",
              });
              localStorage.setItem(
                key,
                JSON.stringify(
                  [...seen, ...unseen.map((t) => `${t.id}:${t.dueAt}`)].slice(
                    -200,
                  ),
                ),
              );
            } catch {
              setError(
                "System notifications are unavailable here. Use the in-app alerts or calendar alarms.",
              );
            }
          }
        }
      } catch (e) {
        if (!c.signal.aborted) setError((e as Error).message);
      } finally {
        active = false;
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 30000);
    const refresh = () => void poll();
    window.addEventListener("collection-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      c.abort();
      clearInterval(timer);
      window.removeEventListener("collection-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [root, userId]);
  return (
    <>
      {error && (
        <p className="muted" role="status">
          Collection alerts: {error}
        </p>
      )}
      {state && (state.dueTasks.length > 0 || state.restock.length > 0) && (
        <div className="collection-alert" role="status">
          <Bell size={18} />
          <span>
            {state.dueTasks.length} task(s) due · {state.restock.length}{" "}
            material(s) at restock threshold
          </span>
          <button onClick={onOpen}>
            Open My collection <ArrowUpRight size={15} />
          </button>
        </div>
      )}
    </>
  );
}

export function Garden({
  root,
  userId,
  section,
  profiles,
  onOpen,
}: {
  root: string;
  userId: string;
  section: CollectionSection;
  profiles: Profile[];
  onOpen: (id: string) => void;
}) {
  const [data, setData] = useState<Snapshot | null>(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [areaId, setAreaId] = useState(""),
    [plantId, setPlantId] = useState("");
  const [dialog, setDialog] = useState<
    "area" | "task" | "supply" | "stock" | null
  >(null);
  const [editArea, setEditArea] = useState<Area | null>(null),
    [editTask, setEditTask] = useState<Task | null>(null),
    [editSupply, setEditSupply] = useState<Supply | null>(null);
  const [taskFilter, setTaskFilter] = useState("all");
  const [notify, setNotify] = useState(
    () => localStorage.getItem(preferenceKey(root, userId)) === "on",
  );
  useEffect(() => {
    const c = new AbortController();
    api<Snapshot>(root + "/garden", { signal: c.signal })
      .then((d) => {
        if (!c.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [root, revision]);
  useEffect(() => {
    const timer = setInterval(() => setRevision((v) => v + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  async function mutate(
    path: string,
    body: unknown,
    method = "POST",
    success = "Saved.",
  ) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(root + path, json(body, method));
      setRevision((v) => v + 1);
      changed();
      setMessage(success);
      return true;
    } catch (e) {
      setError((e as Error).message);
      setRevision((v) => v + 1);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const area = data?.areas.find((a) => a.id === areaId) || data?.areas[0];
  const placement = data?.placements.find((p) => p.specimenId === plantId);
  const profileName = (id: string | null) =>
    profiles.find((p) => p.id === id)?.name || "Collection record";
  function open(kind: "area" | "task" | "supply" | "stock") {
    setDialog(kind);
    setError("");
    setMessage("");
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      v = Object.fromEntries(f);
    let ok = false;
    if (dialog === "area")
      ok = await mutate(
        "/areas" + (editArea ? `/${editArea.id}` : ""),
        {
          ...v,
          ...(editArea
            ? { version: editArea.version }
            : { rows: Number(v.rows), columns: Number(v.columns) }),
        },
        editArea ? "PATCH" : "POST",
        "Area saved.",
      );
    if (dialog === "task")
      ok = await mutate(
        "/garden-tasks" + (editTask ? `/${editTask.id}` : ""),
        {
          ...v,
          specimenId: v.specimenId || null,
          areaId: v.areaId || null,
          dueAt: new Date(String(v.dueAt)).toISOString(),
          ...(editTask ? { version: editTask.version } : {}),
        },
        editTask ? "PATCH" : "POST",
        "Task saved.",
      );
    if (dialog === "supply")
      ok = await mutate(
        "/supplies" + (editSupply ? `/${editSupply.id}` : ""),
        {
          ...v,
          reorderAt: Number(v.reorderAt),
          targetQuantity: Number(v.targetQuantity),
          specimenId: v.specimenId || null,
          ...(editSupply
            ? { version: editSupply.version }
            : { quantity: Number(v.quantity) }),
        },
        editSupply ? "PATCH" : "POST",
        "Material saved.",
      );
    if (dialog === "stock" && editSupply)
      ok = await mutate(
        `/supplies/${editSupply.id}/adjustments`,
        { version: editSupply.version, delta: Number(v.delta), note: v.note },
        "POST",
        "Stock adjustment saved.",
      );
    if (ok) setDialog(null);
  }
  async function toggleNotifications() {
    if (notify) {
      localStorage.removeItem(preferenceKey(root, userId));
      setNotify(false);
      return;
    }
    if (!("Notification" in window)) {
      setError(
        "This browser does not support system notifications. Download a calendar alarm instead.",
      );
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError(
          "Notifications are not allowed. You can enable them in browser settings or use calendar alarms.",
        );
        return;
      }
      new Notification("MasterGrow reminders enabled", {
        body: "Due tasks can notify you while this app remains open.",
      });
      localStorage.setItem(preferenceKey(root, userId), "on");
      setNotify(true);
      changed();
    } catch {
      setError(
        "System notifications are unavailable here. Use calendar alarms instead.",
      );
    }
  }
  if (!data)
    return (
      <div role="status">
        {error || "Loading collection management…"}
        {error && (
          <button onClick={() => setRevision((v) => v + 1)}>Retry</button>
        )}
      </div>
    );
  return (
    <div className="garden-manager">
      {error && !dialog && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {section === "areas" && (
        <>
          <div className="garden-heading">
            <div>
              <span className="eyebrow">A place for every record</span>
              <h2>Map your collection</h2>
              <p>
                Arrange plants and seed lots into named areas. Each cell is a
                position, not a physical spacing recommendation.
              </p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setEditArea(null);
                open("area");
              }}
            >
              <Plus size={16} />
              Add area
            </button>
          </div>
          {!area ? (
            <Empty title="Give your collection a home">
              Create a shelf, room, bed or other area, then place your existing
              records.
            </Empty>
          ) : (
            <div className="garden-area-layout">
              <aside className="garden-panel">
                <label>
                  Area
                  <select
                    value={area.id}
                    onChange={(e) => setAreaId(e.target.value)}
                  >
                    {data.areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="muted">
                  {area.rows} rows × {area.columns} columns
                </p>
                <p className="preserve">{area.notes}</p>
                <button
                  className="text-button"
                  onClick={() => {
                    setEditArea(area);
                    open("area");
                  }}
                >
                  Edit area details
                </button>
                <hr />
                <label>
                  Plant or seed to place
                  <select
                    value={plantId}
                    onChange={(e) => setPlantId(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Choose a record</option>
                    {profiles
                      .filter((p) => p.kind !== "material")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <p className="muted">
                  Choose a record, then tap an empty cell to place or move it.
                </p>
                {placement?.areaId && (
                  <p>
                    Currently in{" "}
                    {data.areas.find((a) => a.id === placement.areaId)?.name},
                    row {placement.row! + 1}, column {placement.column! + 1}.
                  </p>
                )}
                {placement?.areaId && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        `/specimens/${plantId}/placement`,
                        { areaId: null, version: placement.version },
                        "PUT",
                        "Removed from layout; collection history kept.",
                      )
                    }
                  >
                    Remove from layout
                  </button>
                )}
                {!profiles.some((p) => p.kind !== "material") && (
                  <p>Add a plant or seed in Records first.</p>
                )}
              </aside>
              <section className="garden-panel area-map">
                <div className="garden-heading">
                  <h3>{area.name}</h3>
                  <Grid2X2 size={20} />
                </div>
                <div
                  className="area-grid-scroll"
                  tabIndex={0}
                  aria-label="Area map, scroll horizontally for larger layouts"
                >
                  <div
                    className="area-grid"
                    style={{
                      gridTemplateColumns: `repeat(${area.columns}, minmax(88px, 1fr))`,
                    }}
                  >
                    {Array.from(
                      { length: area.rows * area.columns },
                      (_, i) => {
                        const row = Math.floor(i / area.columns),
                          column = i % area.columns;
                        const placed = data.placements.find(
                          (p) =>
                            p.areaId === area.id &&
                            p.row === row &&
                            p.column === column,
                        );
                        return (
                          <button
                            key={i}
                            className={placed ? "occupied" : ""}
                            disabled={busy || (!placed && !plantId)}
                            aria-label={`Row ${row + 1}, column ${column + 1}: ${placed ? profileName(placed.specimenId) : "Empty"}`}
                            onClick={() => {
                              if (placed) {
                                setPlantId(placed.specimenId);
                                return;
                              }
                              void mutate(
                                `/specimens/${plantId}/placement`,
                                {
                                  areaId: area.id,
                                  row,
                                  column,
                                  version: placement?.version || 0,
                                },
                                "PUT",
                                "Placement saved.",
                              );
                            }}
                          >
                            <small>
                              {row + 1}.{column + 1}
                            </small>
                            {placed ? <Sprout size={25} /> : <Plus size={20} />}
                            <span>
                              {placed
                                ? profileName(placed.specimenId)
                                : "Empty"}
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
                {plantId && (
                  <button
                    className="text-button"
                    onClick={() => onOpen(plantId)}
                  >
                    Open {profileName(plantId)} history{" "}
                    <ArrowUpRight size={15} />
                  </button>
                )}
                <p className="muted">
                  Tap an occupied cell to select that record. Its photos and
                  measurements stay in Records.
                </p>
              </section>
            </div>
          )}
        </>
      )}
      {section === "tasks" && (
        <>
          <div className="garden-heading">
            <div>
              <span className="eyebrow">Your next check-in</span>
              <h2>Tasks & reminders</h2>
              <p>
                Set your own deadlines for a plant, an area, or the whole
                collection.
              </p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setEditTask(null);
                open("task");
              }}
            >
              <Plus size={16} />
              Add task
            </button>
          </div>
          <div className="garden-panel reminder-options">
            <Bell size={22} />
            <div>
              <strong>Keep your next task in sight</strong>
              <p>
                In-app alerts refresh every 30 seconds while open. Browser
                notifications depend on device support and permission. Download
                and import a calendar alarm for reminders when the app is
                closed; later changes need a fresh download.
              </p>
            </div>
            <button
              aria-pressed={notify}
              onClick={() => void toggleNotifications()}
            >
              {notify ? "Disable notifications" : "Enable notifications"}
            </button>
          </div>
          <label className="task-filter">
            Show tasks
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
            >
              <option value="all">All tasks</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          {!data.tasks.length ? (
            <Empty title="Nothing scheduled yet">
              Add a task and choose when you want to be reminded.
            </Empty>
          ) : (
            <div className="garden-cards">
              {data.tasks
                .filter((t) => taskFilter === "all" || t.status === taskFilter)
                .map((t) => (
                  <article className="garden-panel task-card" key={t.id}>
                    <span
                      className={
                        "task-state " +
                        (t.status === "pending" &&
                        Date.parse(t.dueAt) <= Date.now()
                          ? "due"
                          : "")
                      }
                    >
                      {t.status === "pending"
                        ? Date.parse(t.dueAt) <= Date.now()
                          ? "Due now"
                          : "Scheduled"
                        : t.status === "completed"
                          ? "Completed"
                          : "Cancelled"}
                    </span>
                    <h3>{t.title}</h3>
                    <time dateTime={t.dueAt}>{dateLabel(t.dueAt)}</time>
                    <p className="preserve">{t.notes}</p>
                    <div className="task-links">
                      {t.specimenId && (
                        <button
                          className="text-button"
                          onClick={() => onOpen(t.specimenId!)}
                        >
                          {profileName(t.specimenId)} <ArrowUpRight size={14} />
                        </button>
                      )}
                      {t.areaId && (
                        <span>
                          {data.areas.find((a) => a.id === t.areaId)?.name}
                        </span>
                      )}
                    </div>
                    {t.completedAt && (
                      <p className="muted">
                        Completed {dateLabel(t.completedAt)}
                      </p>
                    )}
                    <div className="garden-actions">
                      <button
                        disabled={busy}
                        onClick={() =>
                          void mutate(
                            `/garden-tasks/${t.id}`,
                            {
                              version: t.version,
                              status:
                                t.status === "pending"
                                  ? "completed"
                                  : "pending",
                            },
                            "PATCH",
                          )
                        }
                      >
                        {t.status === "pending" ? "Complete" : "Reopen"}
                      </button>
                      {t.status === "pending" && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void mutate(
                                `/garden-tasks/${t.id}`,
                                {
                                  version: t.version,
                                  dueAt: new Date(
                                    Math.max(Date.now(), Date.parse(t.dueAt)) +
                                      3600000,
                                  ).toISOString(),
                                },
                                "PATCH",
                                "Reminder moved one hour later.",
                              )
                            }
                          >
                            Snooze 1 hour
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              setEditTask(t);
                              open("task");
                            }}
                          >
                            Edit task
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void mutate(
                                `/garden-tasks/${t.id}`,
                                { version: t.version, status: "cancelled" },
                                "PATCH",
                              )
                            }
                          >
                            Cancel task
                          </button>
                          <a
                            href={`/api${root}/garden-tasks/${t.id}/calendar`}
                            download
                          >
                            Calendar alarm
                          </a>
                        </>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          )}
          {data.tasks.length > 0 &&
            !data.tasks.some(
              (t) => taskFilter === "all" || t.status === taskFilter,
            ) && <p>No {taskFilter} tasks.</p>}
        </>
      )}
      {section === "materials" && (
        <>
          <div className="garden-heading">
            <div>
              <span className="eyebrow">Know what’s on hand</span>
              <h2>Materials & restocks</h2>
              <p>
                Track stock, set a low-stock threshold and build a restock list
                from your own targets.
              </p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setEditSupply(null);
                open("supply");
              }}
            >
              <Plus size={16} />
              Add material
            </button>
          </div>
          <section className="garden-panel restock-list">
            <div className="garden-heading">
              <h3>
                <Package size={21} />
                Suggested restocks
              </h3>
              <span>{data.restock.length} to review</span>
            </div>
            {data.restock.length ? (
              data.restock.map((s) => (
                <div className="restock-item" key={s.id}>
                  <strong>{s.name}</strong>
                  <span>
                    Add {s.suggestedQuantity} {s.unit} to reach your target.
                  </span>
                </div>
              ))
            ) : (
              <p>No restocks needed</p>
            )}
            <p className="muted">
              Suggestions use the materials and target quantities you enter.
              Nothing is purchased automatically.
            </p>
          </section>
          {!data.supplies.length ? (
            <Empty title="Start your materials inventory">
              Add a material, its quantity and the level that should trigger a
              restock alert.
            </Empty>
          ) : (
            <div className="garden-cards">
              {data.supplies.map((s) => (
                <article className="garden-panel supply-card" key={s.id}>
                  <span className="task-state">
                    {s.quantity <= s.reorderAt ? "Restock needed" : "In stock"}
                  </span>
                  <h3>{s.name}</h3>
                  <strong className="stock-count">
                    {s.quantity} {s.unit} on hand
                  </strong>
                  <p className="muted">
                    Restock at {s.reorderAt} · Target {s.targetQuantity}{" "}
                    {s.unit}
                  </p>
                  <p className="preserve">{s.notes}</p>
                  {s.specimenId && (
                    <button
                      className="text-button"
                      onClick={() => onOpen(s.specimenId!)}
                    >
                      Open material history <ArrowUpRight size={15} />
                    </button>
                  )}
                  <div className="garden-actions">
                    <button
                      disabled={busy}
                      onClick={() => {
                        setEditSupply(s);
                        open("stock");
                      }}
                    >
                      Adjust stock
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setEditSupply(s);
                        open("supply");
                      }}
                    >
                      Edit material
                    </button>
                  </div>
                  <details>
                    <summary>Stock history</summary>
                    {data.adjustments.filter((a) => a.supplyId === s.id)
                      .length ? (
                      data.adjustments
                        .filter((a) => a.supplyId === s.id)
                        .map((a) => (
                          <div className="stock-entry" key={a.id}>
                            <strong>
                              {a.delta > 0 ? "+" : ""}
                              {a.delta} {s.unit} → {a.quantity}
                            </strong>
                            <p>{a.note}</p>
                            <small>
                              {dateLabel(a.createdAt)} · {a.author}
                            </small>
                          </div>
                        ))
                    ) : (
                      <p>
                        No adjustments yet. Starting quantity: {s.quantity}{" "}
                        {s.unit}.
                      </p>
                    )}
                  </details>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {dialog && (
        <Modal
          title={
            dialog === "area"
              ? "Area details"
              : dialog === "task"
                ? "Task reminder"
                : dialog === "supply"
                  ? "Material inventory"
                  : "Adjust stock"
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
          <form onSubmit={(e) => void submit(e)}>
            <fieldset disabled={busy}>
              {dialog === "area" && (
                <>
                  <label>
                    Area name
                    <input
                      name="name"
                      required
                      maxLength={200}
                      defaultValue={editArea?.name}
                    />
                  </label>
                  {!editArea && (
                    <div className="form-pair">
                      <label>
                        Rows
                        <input
                          name="rows"
                          type="number"
                          min="1"
                          max="12"
                          required
                          defaultValue="3"
                        />
                      </label>
                      <label>
                        Columns
                        <input
                          name="columns"
                          type="number"
                          min="1"
                          max="12"
                          required
                          defaultValue="3"
                        />
                      </label>
                    </div>
                  )}
                  <label>
                    Area notes
                    <textarea
                      name="notes"
                      maxLength={4000}
                      defaultValue={editArea?.notes}
                    />
                  </label>
                </>
              )}
              {dialog === "task" && (
                <>
                  <label>
                    Task title
                    <input
                      name="title"
                      required
                      maxLength={200}
                      defaultValue={editTask?.title}
                    />
                  </label>
                  <label>
                    Remind me at
                    <input
                      name="dueAt"
                      type="datetime-local"
                      required
                      defaultValue={localDate(
                        editTask?.dueAt ||
                          new Date(Date.now() + 3600000).toISOString(),
                      )}
                    />
                  </label>
                  <p className="muted">
                    Time is shown in your device’s local time zone.
                  </p>
                  <label>
                    Linked collection record
                    <select
                      name="specimenId"
                      defaultValue={editTask?.specimenId || ""}
                    >
                      <option value="">Whole collection</option>
                      {profiles.map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Linked area
                    <select name="areaId" defaultValue={editTask?.areaId || ""}>
                      <option value="">No specific area</option>
                      {data.areas.map((a) => (
                        <option value={a.id} key={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Task notes
                    <textarea
                      name="notes"
                      maxLength={4000}
                      defaultValue={editTask?.notes}
                    />
                  </label>
                </>
              )}
              {dialog === "supply" && (
                <>
                  <label>
                    Material name
                    <input
                      name="name"
                      required
                      maxLength={200}
                      defaultValue={editSupply?.name}
                    />
                  </label>
                  <label>
                    Stock unit
                    <input
                      name="unit"
                      required
                      maxLength={30}
                      placeholder="e.g. pieces"
                      defaultValue={editSupply?.unit}
                      readOnly={Boolean(editSupply)}
                    />
                  </label>
                  {editSupply && (
                    <p className="muted">
                      The stock unit stays fixed so adjustment history remains
                      consistent.
                    </p>
                  )}
                  {!editSupply && (
                    <label>
                      Current quantity
                      <input
                        name="quantity"
                        required
                        type="number"
                        min="0"
                        max="1000000000"
                        step="any"
                        defaultValue="0"
                      />
                    </label>
                  )}
                  <div className="form-pair">
                    <label>
                      Restock at or below
                      <input
                        name="reorderAt"
                        required
                        type="number"
                        min="0"
                        max="1000000000"
                        step="any"
                        defaultValue={editSupply?.reorderAt ?? 0}
                      />
                    </label>
                    <label>
                      Target quantity
                      <input
                        name="targetQuantity"
                        required
                        type="number"
                        min="0"
                        max="1000000000"
                        step="any"
                        defaultValue={editSupply?.targetQuantity ?? 1}
                      />
                    </label>
                  </div>
                  <label>
                    Linked material record
                    <select
                      name="specimenId"
                      defaultValue={editSupply?.specimenId || ""}
                    >
                      <option value="">Inventory only</option>
                      {profiles
                        .filter((p) => p.kind === "material")
                        .map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Material notes
                    <textarea
                      name="notes"
                      maxLength={4000}
                      defaultValue={editSupply?.notes}
                    />
                  </label>
                </>
              )}
              {dialog === "stock" && editSupply && (
                <>
                  <p>
                    {editSupply.name} · {editSupply.quantity} {editSupply.unit}{" "}
                    on hand
                  </p>
                  <label>
                    Quantity change
                    <input
                      name="delta"
                      type="number"
                      step="any"
                      required
                      min={-editSupply.quantity}
                      max={1e9 - editSupply.quantity}
                      placeholder="e.g. 8 to add, -2 to use"
                    />
                  </label>
                  <label>
                    Adjustment note
                    <textarea name="note" required maxLength={1000} />
                  </label>
                </>
              )}
              <button className="primary" disabled={busy}>
                {busy
                  ? "Saving…"
                  : dialog === "area"
                    ? "Save area"
                    : dialog === "task"
                      ? "Save task"
                      : dialog === "supply"
                        ? "Save material"
                        : "Save adjustment"}
              </button>
            </fieldset>
          </form>
        </Modal>
      )}
    </div>
  );
}
