"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert } from "lucide-react";
import { STATUS_LABEL, type CampaignStatus } from "@/lib/campaign";
import { cn } from "@/lib/utils";
import { socialApi } from "@/components/social/parts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/* Campaign Planner (CP-01): small pieces shared by the planner pages. */

export const field =
  "w-full rounded-2xl border bg-background px-3.5 py-2.5 text-[0.92rem] outline-none transition-[border-color,box-shadow] focus-visible:border-primary/40 focus-visible:ring-3 focus-visible:ring-primary/20 disabled:opacity-60 dark:bg-white/[0.02]";
export const label = "text-[0.78rem] font-semibold";
export const compactField = "h-10 rounded-full border bg-background px-3.5 text-[0.85rem] outline-none focus-visible:border-primary/40 focus-visible:ring-3 focus-visible:ring-primary/20 dark:bg-white/[0.02]";

const STATUS_STYLE: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  planned: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#b9a6ff]",
  active: "bg-lime/70 text-[#1b2400]",
  completed: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  archived: "border border-dashed text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: CampaignStatus; className?: string }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold", STATUS_STYLE[status], className)}>{STATUS_LABEL[status]}</span>;
}

/** A progress bar for a real count of completed tasks; shows "No tasks yet" instead of an invented 0%. */
export function Progress({ done, total, className, labelled = true }: { done: number; total: number; className?: string; labelled?: boolean }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : null;
  return (
    <div className={className}>
      {labelled ? (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.74rem]">
          <span className="text-muted-foreground">{total ? `${done} of ${total} to-dos done` : "No to-dos yet"}</span>
          {pct !== null ? <span className="font-bold tabular-nums">{pct}%</span> : null}
        </div>
      ) : null}
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" {...(pct !== null ? { role: "progressbar", "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": "To-dos done" } : { "aria-hidden": true })}>
        {pct ? <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${pct}%` }} /> : null}
      </div>
    </div>
  );
}

export type Notice = { ok: boolean; text: string } | null;

export function NoticeBar({ notice, className }: { notice: Notice; className?: string }) {
  return (
    <div className={cn("min-h-0", className)} aria-live="polite">
      {notice ? (
        <p role={notice.ok ? "status" : "alert"} className={cn("flex items-start gap-2 rounded-2xl px-4 py-3 text-[0.85rem] font-medium", notice.ok ? "bg-secondary text-secondary-foreground" : "bg-destructive/[0.08] text-[#a12828] dark:text-destructive")}>
          {notice.ok ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Runs one request at a time (a double click or a rapid second action is ignored while one is in flight), shows the
 * outcome, and reloads the server data on success.
 */
export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice>(null);
  const inFlight = React.useRef(false);
  const run = React.useCallback(
    async <T,>(key: string, path: string, init: RequestInit, ok?: string | ((data: T) => string)): Promise<T | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setBusy(key);
      setNotice(null);
      const r = await socialApi<T>(path, init);
      inFlight.current = false;
      setBusy(null);
      if (!r.ok) {
        setNotice({ ok: false, text: r.message });
        return null;
      }
      if (ok) setNotice({ ok: true, text: typeof ok === "function" ? ok(r.data) : ok });
      router.refresh();
      return r.data;
    },
    [router],
  );
  return { busy, notice, setNotice, run };
}

export function DialogFrame({ open, onClose, title, description, children, footer, wide }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; footer: React.ReactNode; wide?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn("max-h-[88dvh] gap-0 overflow-hidden p-0", wide ? "sm:max-w-2xl" : "sm:max-w-md")} showCloseButton={false}>
        <div className="border-b px-5 pt-5 pb-4">
          <DialogTitle className="font-heading text-lg font-extrabold">{title}</DialogTitle>
          {description ? <DialogDescription className="mt-1 text-[0.82rem] text-muted-foreground">{description}</DialogDescription> : null}
        </div>
        <div className="max-h-[60dvh] overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3.5">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}

export const json =(method: string, body?: unknown): RequestInit => ({ method, ...(body !== undefined && { body: JSON.stringify(body) }) });
