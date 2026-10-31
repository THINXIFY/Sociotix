/*
 * Shared look for the public header: top-level nav items (links and the More Solutions trigger)
 * and the right-hand controls. One height (36px), one radius family, 150ms transitions.
 */

export const navItem =
  "relative inline-flex h-9 items-center gap-1 rounded-md px-3 text-[0.875rem] font-medium tracking-[-0.006em] whitespace-nowrap outline-none transition-[color,background-color] duration-150 hover:bg-foreground/[0.045] focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none dark:hover:bg-white/[0.06]";
export const navItemIdle = "text-foreground/65 hover:text-foreground";
export const navItemActive = "text-foreground";

/**
 * The active item's violet bar: 2px, faded at both ends, resting exactly on the header's bottom
 * edge (64px bar + 1px border). It glides between items with a restrained spring (shared layoutId);
 * the app's MotionConfig turns that into an instant move for reduced motion.
 */
export const NAV_INDICATOR_ID = "nav-indicator";
export const navIndicator =
  "pointer-events-none absolute inset-x-3 -bottom-[0.9375rem] h-[2px] rounded-full bg-[linear-gradient(90deg,transparent,var(--color-primary)_18%,var(--color-primary)_82%,transparent)]";
export const navIndicatorTransition = { type: "spring", stiffness: 380, damping: 38, mass: 0.7 } as const;

const control =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[10px] text-sm whitespace-nowrap outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none";
/** Quiet text action (Log In). */
export const controlGhost = `${control} px-3 font-medium text-foreground/75 hover:bg-foreground/[0.045] hover:text-foreground dark:hover:bg-white/[0.06]`;
/** The one primary action (Sign Up / Dashboard): a soft violet lift on hover, a slight press on click. */
export const controlPrimary = `${control} bg-primary px-4 font-semibold text-primary-foreground shadow-[0_6px_16px_-8px_rgb(112_71_235/0.7),inset_0_1px_0_rgb(255_255_255/0.18)] hover:bg-primary/92 hover:shadow-[0_10px_22px_-10px_rgb(112_71_235/0.85),inset_0_1px_0_rgb(255_255_255/0.22)] active:translate-y-px motion-reduce:active:translate-y-0 dark:shadow-none dark:hover:shadow-[0_10px_24px_-12px_rgb(146_119_244/0.7)]`;
/** Refined secondary action (AI Tools): hairline border and shadow, violet on hover. */
export const controlOutline = `${control} border border-border bg-card/70 px-3 font-medium text-foreground shadow-[0_1px_2px_rgb(32_33_39/0.05)] hover:border-primary/30 hover:bg-primary/[0.04] hover:text-primary dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none dark:hover:border-primary/40 dark:hover:bg-primary/10 dark:hover:text-[#c9bcff]`;
/** Compact icon control (theme, menu). */
export const controlIcon = `${control} size-9 text-foreground/70 hover:bg-foreground/[0.045] hover:text-foreground dark:hover:bg-white/[0.06]`;
