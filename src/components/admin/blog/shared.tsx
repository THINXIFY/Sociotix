"use client";

import * as React from "react";
import { CalendarClock, CircleCheck, PencilLine } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { POST_STATE_LABEL, type PostState } from "@/lib/blog/admin";
import { cn } from "@/lib/utils";

/* Pieces shared by the Blog Management list and editor. */

const STATE_STYLE: Record<PostState, { className: string; Icon: typeof CircleCheck }> = {
  draft: { className: "bg-muted text-muted-foreground", Icon: PencilLine },
  scheduled: { className: "bg-soon-soft text-soon", Icon: CalendarClock },
  published: { className: "bg-ok-soft text-ok", Icon: CircleCheck },
};

export function PostStatus({ state, className }: { state: PostState; className?: string }) {
  const { className: tone, Icon } = STATE_STYLE[state];
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.72rem] font-semibold whitespace-nowrap ring-1 ring-current/15 ring-inset", tone, className)}>
      <Icon className="size-3" strokeWidth={2.5} aria-hidden />
      {POST_STATE_LABEL[state]}
    </span>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div>
          <DialogTitle className="font-heading text-lg font-bold">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">{description}</DialogDescription>
        </div>
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="h-10 rounded-full border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn("h-10 rounded-full px-5 text-sm font-semibold disabled:opacity-60", danger ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90")}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** JSON API call for blog admin routes (same error shape as the rest of the admin). */
export async function blogApi<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    const isForm = init.body instanceof FormData;
    res = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store", headers: { accept: "application/json", ...(init.body && !isForm ? { "content-type": "application/json" } : {}), ...(init.headers ?? {}) } });
  } catch {
    throw Object.assign(new Error("We couldn't reach Sociotix. Check your connection and try again."), { field: undefined as string | undefined, status: 0 });
  }
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; field?: string; issues?: { path: string; message: string }[] } } | null;
  if (!res.ok) {
    const e = body?.error;
    const issue = e?.issues?.[0];
    throw Object.assign(new Error(issue ? `${issue.message}` : (e?.message ?? "Something went wrong. Please try again.")), { field: e?.field ?? issue?.path.split(".")[0], status: res.status });
  }
  return body as T;
}
