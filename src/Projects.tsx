import { useState, type FormEvent } from "react";
import { MapPin, FolderOpen, Plus, ArrowUpRight } from "lucide-react";
import { api } from "./types";
import { Modal, Empty } from "./ui";
export type Scope = { siteId: string; projectId: string };
export type ScopedRecord = {
  id: string;
  siteId?: string | null;
  projectId?: string | null;
  organizationVersion?: number;
};
type Counts = {
  recordCount: number;
  areaCount: number;
  supplyCount: number;
  taskCount: number;
  completedTasks: number;
  dueTasks: number;
};
type Site = Counts & {
  id: string;
  name: string;
  location: string;
  notes: string;
  version: number;
};
type Project = Counts & {
  id: string;
  name: string;
  notes: string;
  siteIds: string[];
  status: "planned" | "active" | "paused" | "completed";
  startDate: string | null;
  targetDate: string | null;
  version: number;
};
export type Organization = { sites: Site[]; projects: Project[] };
export const matchesScope = (record: ScopedRecord, scope: Scope) =>
  (!scope.siteId || record.siteId === scope.siteId) &&
  (!scope.projectId || record.projectId === scope.projectId);
export const scopeBody = (scope: Scope) => ({
  siteId: scope.siteId || null,
  projectId: scope.projectId || null,
});
const json = (body: unknown, method = "POST") => ({
  method,
  body: JSON.stringify(body),
});
export const organizationChanged = () =>
  window.dispatchEvent(new Event("collection-changed"));
export function ScopeFilters({
  data,
  scope,
  onChange,
  disabled,
}: {
  data: Organization;
  scope: Scope;
  onChange: (s: Scope) => void;
  disabled: boolean;
}) {
  if (!data.sites.length) return null;
  return (
    <div className="scope-filters">
      <MapPin size={20} />
      <label>
        Filter by site
        <select
          disabled={disabled}
          value={scope.siteId}
          onChange={(e) => {
            const id = e.target.value;
            onChange({
              siteId: id,
              projectId:
                scope.projectId &&
                id &&
                !data.projects
                  .find((p) => p.id === scope.projectId)
                  ?.siteIds.includes(id)
                  ? ""
                  : scope.projectId,
            });
          }}
        >
          <option value="">All sites</option>
          {data.sites.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Filter by project
        <select
          disabled={disabled}
          value={scope.projectId}
          onChange={(e) => onChange({ ...scope, projectId: e.target.value })}
        >
          <option value="">All projects</option>
          {data.projects
            .filter((p) => !scope.siteId || p.siteIds.includes(scope.siteId))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
      <p>
        New collection items use these selections. All sites includes unassigned
        records.
      </p>
    </div>
  );
}
export function ScopeAssignment({
  root,
  type,
  record,
  data,
  onSaved,
}: {
  root: string;
  type: "specimen" | "area" | "gardenTask" | "supply";
  record: ScopedRecord;
  data: Organization;
  onSaved: () => void;
}) {
  const [baseVersion, setBaseVersion] = useState(0);
  const [open, setOpen] = useState(false),
    [scope, setScope] = useState<Scope>({ siteId: "", projectId: "" }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const label =
    [
      data.sites.find((s) => s.id === record.siteId)?.name,
      data.projects.find((p) => p.id === record.projectId)?.name,
    ]
      .filter(Boolean)
      .join(" · ") || "No site or project assigned";
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        root + `/organization/${type}/${record.id}`,
        json({ ...scopeBody(scope), version: baseVersion }, "PUT"),
      );
      setOpen(false);
      onSaved();
      organizationChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="scope-assignment">
      <small>{label}</small>
      {data.sites.length > 0 && (
        <button
          className="text-button"
          onClick={() => {
            setBaseVersion(record.organizationVersion || 0);
            setScope({
              siteId: record.siteId || "",
              projectId: record.projectId || "",
            });
            setError("");
            setOpen(true);
          }}
        >
          Assign site & project
        </button>
      )}
      {open && (
        <Modal
          title="Assign site & project"
          close={() => {
            if (!busy) {
              setOpen(false);
              onSaved();
            }
          }}
        >
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <form onSubmit={(e) => void save(e)}>
            <fieldset disabled={busy}>
              <label>
                Assigned site
                <select
                  value={scope.siteId}
                  onChange={(e) =>
                    setScope({ siteId: e.target.value, projectId: "" })
                  }
                >
                  <option value="">No specific site</option>
                  {data.sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Assigned project
                <select
                  value={scope.projectId}
                  onChange={(e) =>
                    setScope({ ...scope, projectId: e.target.value })
                  }
                >
                  <option value="">No project</option>
                  {data.projects
                    .filter(
                      (p) => !scope.siteId || p.siteIds.includes(scope.siteId),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <p className="muted">
                Linked records must have compatible site and project
                assignments. To move a placed plant to another site, remove its
                layout placement first.
              </p>
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : "Save assignment"}
              </button>
            </fieldset>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function Projects({
  root,
  data,
  onSaved,
  onOpen,
}: {
  root: string;
  data: Organization;
  onSaved: () => void;
  onOpen: (scope: Scope) => void;
}) {
  const [dialog, setDialog] = useState<"site" | "project" | null>(null),
    [site, setSite] = useState<Site | null>(null),
    [project, setProject] = useState<Project | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function open(kind: "site" | "project") {
    setError("");
    setDialog(kind);
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      body = Object.fromEntries(f);
    setBusy(true);
    setError("");
    try {
      if (dialog === "site")
        await api(
          root + "/sites" + (site ? `/${site.id}` : ""),
          json(
            { ...body, ...(site ? { version: site.version } : {}) },
            site ? "PATCH" : "POST",
          ),
        );
      else
        await api(
          root + "/projects" + (project ? `/${project.id}` : ""),
          json(
            {
              ...body,
              siteIds: f.getAll("siteIds"),
              startDate: body.startDate || null,
              targetDate: body.targetDate || null,
              ...(project ? { version: project.version } : {}),
            },
            project ? "PATCH" : "POST",
          ),
        );
      setDialog(null);
      onSaved();
      organizationChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="projects-page">
      <div className="garden-heading">
        <div>
          <span className="eyebrow">One collection. Every location.</span>
          <h2>Projects & sites</h2>
          <p>
            Organize grow projects across your locations. Track your own records
            and task progress, with shared workspace access.
          </p>
        </div>
        <div className="garden-actions">
          <button
            onClick={() => {
              setSite(null);
              open("site");
            }}
          >
            <MapPin size={15} /> Add site
          </button>
          <button
            className="primary"
            disabled={!data.sites.length}
            onClick={() => {
              setProject(null);
              open("project");
            }}
          >
            <Plus size={15} /> Add project
          </button>
        </div>
      </div>
      <section aria-label="Site locations">
        <h3 className="project-section-heading">
          Your sites <span>{data.sites.length}</span>
        </h3>
        {!data.sites.length ? (
          <Empty title="Start with a location">
            Add a home, facility or other site. Then group work into projects.
          </Empty>
        ) : (
          <div className="garden-cards">
            {data.sites.map((s) => (
              <article className="garden-panel site-card" key={s.id}>
                <MapPin size={22} />
                <h3>{s.name}</h3>
                <p className="preserve">{s.location}</p>
                <p className="muted preserve">{s.notes}</p>
                <div className="project-counts">
                  <span>{s.recordCount} records</span>
                  <span>{s.areaCount} areas</span>
                  <span>{s.supplyCount} materials</span>
                </div>
                <div className="garden-actions">
                  <button
                    onClick={() => onOpen({ siteId: s.id, projectId: "" })}
                  >
                    Open site <ArrowUpRight size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setSite(s);
                      open("site");
                    }}
                  >
                    Edit site
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section aria-label="Grow projects">
        <h3 className="project-section-heading">
          Grow projects <span>{data.projects.length}</span>
        </h3>
        {!data.projects.length ? (
          <Empty title="Give your work a project">
            Choose one or more sites, add your own dates and organize the work
            you want to track.
          </Empty>
        ) : (
          <div className="garden-cards">
            {data.projects.map((p) => (
              <article className="garden-panel project-card" key={p.id}>
                <div className="project-card-top">
                  <FolderOpen size={23} />
                  <span className="task-state">
                    {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                  </span>
                </div>
                <h3>{p.name}</h3>
                <p className="project-sites">
                  {p.siteIds
                    .map((id) => data.sites.find((s) => s.id === id)?.name)
                    .join(" · ")}
                </p>
                <p className="preserve">{p.notes}</p>
                {(p.startDate || p.targetDate) && (
                  <p className="muted">
                    {p.startDate || "No start date"} →{" "}
                    {p.targetDate || "No target date"}
                  </p>
                )}
                <div className="project-counts">
                  <span>{p.recordCount} records</span>
                  <span>{p.areaCount} areas</span>
                  <span>{p.supplyCount} materials</span>
                </div>
                <label className="project-progress">
                  {p.completedTasks} of {p.taskCount} tasks completed
                  <progress value={p.completedTasks} max={p.taskCount || 1} />
                </label>
                <p className="muted">
                  {p.dueTasks} tasks due · Project status is set manually.
                </p>
                <div className="garden-actions">
                  <button
                    onClick={() => onOpen({ siteId: "", projectId: p.id })}
                  >
                    Open project <ArrowUpRight size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setProject(p);
                      open("project");
                    }}
                  >
                    Edit project
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {dialog && (
        <Modal
          title={dialog === "site" ? "Site details" : "Grow project"}
          close={() => {
            if (!busy) {
              setDialog(null);
              onSaved();
            }
          }}
        >
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <form onSubmit={(e) => void save(e)}>
            <fieldset disabled={busy}>
              {dialog === "site" ? (
                <>
                  <label>
                    Site name
                    <input
                      name="name"
                      required
                      maxLength={200}
                      defaultValue={site?.name}
                    />
                  </label>
                  <label>
                    Location or address
                    <input
                      name="location"
                      maxLength={500}
                      defaultValue={site?.location}
                    />
                  </label>
                  <label>
                    Site notes
                    <textarea
                      name="notes"
                      maxLength={4000}
                      defaultValue={site?.notes}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Project name
                    <input
                      name="name"
                      required
                      maxLength={200}
                      defaultValue={project?.name}
                    />
                  </label>
                  <label>
                    Project status
                    <select
                      name="status"
                      defaultValue={project?.status || "planned"}
                    >
                      <option value="planned">Planned</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="completed">Completed</option>
                    </select>
                  </label>
                  <fieldset className="project-site-picker">
                    <legend>Sites in this project (choose at least one)</legend>
                    {data.sites.map((s) => (
                      <label key={s.id}>
                        <input
                          name="siteIds"
                          type="checkbox"
                          value={s.id}
                          defaultChecked={project?.siteIds.includes(s.id)}
                        />
                        {s.name}
                      </label>
                    ))}
                  </fieldset>
                  <div className="form-pair">
                    <label>
                      Start date
                      <input
                        name="startDate"
                        type="date"
                        defaultValue={project?.startDate || ""}
                      />
                    </label>
                    <label>
                      Target date
                      <input
                        name="targetDate"
                        type="date"
                        defaultValue={project?.targetDate || ""}
                      />
                    </label>
                  </div>
                  <label>
                    Project notes
                    <textarea
                      name="notes"
                      maxLength={4000}
                      defaultValue={project?.notes}
                    />
                  </label>
                </>
              )}
              <button className="primary" disabled={busy}>
                {busy
                  ? "Saving…"
                  : dialog === "site"
                    ? "Save site"
                    : "Save project"}
              </button>
            </fieldset>
          </form>
        </Modal>
      )}
    </div>
  );
}
