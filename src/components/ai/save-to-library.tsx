"use client";

import * as React from "react";
import Link from "next/link";
import { BookmarkPlus, Check } from "lucide-react";
import { isSocialProvider, SOCIAL_PLATFORMS } from "@/lib/social/platforms";
import { CONTENT_ROUTES } from "@/lib/social/content";
import { POST_TEXT_MAX } from "@/lib/social/publishing";
import { browserTimeZone } from "@/lib/social/time";
import { cn } from "@/lib/utils";

/**
 * "Save to Library" for a result that really exists on screen (an edited caption): it becomes a draft in the
 * customer's Content Library, ready to edit, organise and plan. It never posts anything and needs no
 * connected account. Signed-out visitors are told to sign in.
 */
export function SaveToLibraryButton({ text, platform, label, className }: { text: string; platform?: string; label: string; className?: string }) {
  const [state, setState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = React.useState("");
  const provider = SOCIAL_PLATFORMS.find((p) => p.name.toLowerCase() === platform?.toLowerCase())?.id;

  async function save() {
    if (state === "saving") return;
    const body = text.trim();
    if (!body) {
      setState("error");
      setMessage("There's no text to save yet.");
      return;
    }
    setState("saving");
    try {
      const res = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: Array.from(body).slice(0, POST_TEXT_MAX).join(""), providers: provider && isSocialProvider(provider) ? [provider] : [], timezone: browserTimeZone() }),
      });
      if (res.ok) {
        setState("saved");
        setMessage("Saved to your Content Library as a draft.");
        return;
      }
      const json = await res.json().catch(() => null);
      setState("error");
      setMessage(res.status === 401 ? "Sign in to save results to your Content Library." : (json?.error?.message ?? "Couldn't save. Please try again."));
    } catch {
      setState("error");
      setMessage("We couldn't reach Sociotix. Check your connection and try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={save}
        disabled={state === "saving"}
        aria-label={label}
        title={label}
        className={cn(
          "relative inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none disabled:opacity-60",
          state === "saved" && "text-primary",
          className,
        )}
      >
        {state === "saved" ? <Check className="size-3.5" aria-hidden /> : <BookmarkPlus className="size-3.5" aria-hidden />}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "saving" ? "Saving…" : state === "saved" ? message : ""}
      </span>
      {state === "saved" ? (
        <Link href={CONTENT_ROUTES.library} className="text-[0.7rem] font-semibold text-primary hover:underline">
          View
        </Link>
      ) : state === "error" ? (
        <span role="alert" className="text-[0.7rem] font-medium text-destructive">
          {message}
        </span>
      ) : null}
    </>
  );
}
