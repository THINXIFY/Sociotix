"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Download, ExternalLink, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadStyles } from "./styles";

/*
 * Downloads go through the DP-03 permission-checked endpoints. Files are fetched here so the customer gets clear
 * feedback (and stays on the page) instead of a bare error page; links open the endpoint, which checks access
 * and redirects. Either way, the server records the download and the history refreshes.
 */


const filenameFrom = (header: string | null, fallback: string) => {
  const star = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (star) {
    try {
      return decodeURIComponent(star);
    } catch {}
  }
  return header?.match(/filename="([^"]+)"/i)?.[1] ?? fallback;
};

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done" } | { kind: "error"; message: string };

export function FileDownloadButton({ href, name, label, variant = "primary", className }: { href: string; name: string; label?: React.ReactNode; variant?: keyof typeof downloadStyles; className?: string }) {
  const router = useRouter();
  const [state, setState] = React.useState<State>({ kind: "idle" });
  const id = React.useId();

  const download = async () => {
    setState({ kind: "busy" });
    try {
      const res = await fetch(href, { credentials: "same-origin", redirect: "manual", cache: "no-store" });
      if (res.type === "opaqueredirect" || res.status === 401 || res.status === 303) throw new Error("Your session has ended. Sign in again to download.");
      if (!res.ok) {
        const text = res.headers.get("content-type")?.startsWith("text/plain") ? (await res.text()).slice(0, 200) : "";
        throw new Error(res.status === 404 ? "This file is no longer available." : text || "This download isn't available right now.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFrom(res.headers.get("content-disposition"), name);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setState({ kind: "done" });
      router.refresh();
    } catch (e) {
      setState({ kind: "error", message: e instanceof TypeError ? "We couldn't reach Sociotix. Check your connection and try again." : e instanceof Error ? e.message : "That download didn't work. Try again." });
    }
  };

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <button type="button" onClick={download} disabled={state.kind === "busy"} aria-describedby={state.kind === "error" || state.kind === "done" ? id : undefined} className={downloadStyles[variant]}>
        {state.kind === "busy" ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : state.kind === "done" ? <Check className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />}
        <span className="min-w-0 truncate">{label ?? "Download"}</span>
        {state.kind === "busy" ? <span className="sr-only">Downloading…</span> : null}
      </button>
      <span id={id} role="status" aria-live="polite" className={cn("text-xs", state.kind === "error" ? "font-medium text-destructive" : "text-muted-foreground", state.kind !== "error" && state.kind !== "done" && "sr-only")}>
        {state.kind === "error" ? (
          <span className="inline-flex items-start gap-1">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden /> {state.message}
          </span>
        ) : state.kind === "done" ? (
          "Download started."
        ) : null}
      </span>
    </span>
  );
}

export function LinkDownloadButton({ href, label, provider, variant = "secondary", className }: { href: string; label: string; provider?: string | null; variant?: keyof typeof downloadStyles; className?: string }) {
  const router = useRouter();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={() => window.setTimeout(() => router.refresh(), 1500)}
      className={cn(downloadStyles[variant], className)}
    >
      <ExternalLink className="size-4" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
      {provider ? <span className="font-normal text-muted-foreground">· {provider}</span> : null}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
