import { useEffect, useRef, type ReactNode } from "react";
import { Cannabis, X, ArrowUpRight, FolderOpen } from "lucide-react";
import { labels } from "./types";
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Cannabis size={29} />
      </span>
      <span>
        MasterGrow<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={"badge badge-" + status}>
      <i />
      {labels[status] || status}
    </span>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <FolderOpen size={30} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="dialog-title"
    >
      <header className="modal-header">
        <h2 id="dialog-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          onClick={close}
          aria-label="Close dialog"
        >
          <X />
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function SectionHeading({
  title,
  action,
  onClick,
}: {
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action && (
        <button className="text-button" onClick={onClick}>
          {action}
          <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}
export function Botanical() {
  return (
    <svg className="botanical" viewBox="0 0 320 300" aria-hidden="true">
      <defs>
        <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#b7c894" />
          <stop offset="1" stopColor="#5e7b53" />
        </linearGradient>
      </defs>
      <circle cx="173" cy="158" r="125" fill="#e6e9d9" />
      <g fill="url(#leaf)" stroke="#4f7049" strokeWidth="1.3">
        <path d="M145 280Q163 164 202 37" fill="none" strokeWidth="3" />
        <path d="M174 171Q89 170 71 94Q155 93 174 171Z" />
        <path d="M190 113Q171 36 230 17Q248 78 190 113Z" />
        <path d="M156 234Q75 224 57 157Q133 158 156 234Z" />
        <path d="M165 204Q185 130 267 140Q252 204 165 204Z" />
        <path d="M184 137Q228 72 279 90Q249 147 184 137Z" />
        <path d="M145 280Q177 218 241 230Q219 281 145 280Z" />
      </g>
      <g fill="none" stroke="#e2e8ca" strokeWidth="1">
        <path d="M174 171L82 103M156 234L69 166M165 204L254 148M190 113L227 30M184 137L266 96M145 280L229 237" />
      </g>
    </svg>
  );
}
