import { cn } from "@/lib/utils";

/* Button styles for the Digital Library. A plain module so server and client components can both use them. */

const base = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-[background-color,color,transform] duration-200 focus-visible:ring-3 focus-visible:ring-primary/35 focus-visible:outline-none disabled:pointer-events-none";

export const downloadStyles = {
  primary: cn(base, "bg-primary text-primary-foreground shadow-[0_12px_28px_-16px_rgb(112_71_235/0.9)] hover:-translate-y-px hover:bg-primary/92 motion-reduce:hover:translate-y-0"),
  secondary: cn(base, "border bg-card text-foreground hover:bg-muted dark:bg-white/[0.04]"),
  quiet: cn(base, "min-h-9 px-3 text-primary hover:bg-primary/[0.08] dark:text-[#c4b5ff]"),
};
