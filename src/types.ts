export type User = { id: string; name: string; email: string };
export type Workspace = {
  id: string;
  name: string;
  kind: "home" | "facility";
  role: "owner" | "reviewer" | "member";
};
export type Media = {
  id: string;
  title: string;
  filename: string;
  mime: string;
  size: number;
  status: string;
  createdAt: string;
  processingError: string | null;
  procedureId?: string;
  uploadedBy: string;
};
export type Procedure = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  questions: string[];
  gaps: string[];
  status: string;
  version: number;
  createdAt: string;
  sourceId?: string;
  author: string;
  approvedBy?: string;
};
export type Journal = {
  id: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;
};
export type Member = User & { role: string };
export type Assignment = {
  id: string;
  title: string;
  assignee: string;
  userId: string;
  dueDate: string;
  completedAt: string | null;
  snapshot: Procedure;
};
export type Audit = {
  id: string;
  actor: string;
  action: string;
  target: string;
  created: string;
};
export type Data = {
  media: Media[];
  procedures: Procedure[];
  journals: Journal[];
  members: Member[];
  assignments: Assignment[];
  audit: Audit[];
};
export type Config = {
  aiEnabled: boolean;
  provider: string;
  maxUploadMB: number;
  videoAnalysis: string;
};
export const emptyData: Data = {
  media: [],
  procedures: [],
  journals: [],
  members: [],
  assignments: [],
  audit: [],
};
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch("/api" + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const body = await res.json();
  if (!res.ok)
    throw new Error(body.error || "Request failed. Please try again.");
  return body;
}
export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const labels: Record<string, string> = {
  stored: "Stored",
  queued: "Queued",
  processing: "Analyzing",
  draft: "Draft",
  review: "In review",
  approved: "Approved",
  blocked: "Outside scope",
  failed: "Needs attention",
  waiting_configuration: "AI setup needed",
};
