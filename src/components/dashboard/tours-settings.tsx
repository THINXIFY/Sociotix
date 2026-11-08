"use client";

import { Check } from "lucide-react";
import { TOURS, type TourId, useCompletedTours, useStartTour } from "@/components/tour/guided-tour";
import { SettingRow } from "./account-ui";

const ORDER: TourId[] = ["dashboard", "new-order", "ai", "search"];

/** Settings → Preferences: replay any guided tour. Completion is remembered in this browser only. */
export function GuidedToursRow() {
  const start = useStartTour();
  const done = useCompletedTours();
  return (
    <SettingRow title="Guided tours" description="Short walkthroughs of the dashboard, New Order, AI tools and search. Take one any time.">
      {/* A fixed width keeps the list inside the row (the control column never shrinks); text wraps within it. */}
      <ul className="grid w-full grid-cols-1 gap-1.5 sm:w-80">
        {ORDER.map((id) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => start(id)}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-start text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
            >
              <span className="min-w-0">
                <span className="block">{TOURS[id].name}</span>
                <span className="block text-xs font-normal text-muted-foreground">{TOURS[id].summary}</span>
              </span>
              {done.includes(id) ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime/45 px-2 py-0.5 text-[0.68rem] font-semibold text-graphite dark:bg-lime/15 dark:text-lime">
                  <Check className="size-3" strokeWidth={3} aria-hidden /> Taken
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </SettingRow>
  );
}
