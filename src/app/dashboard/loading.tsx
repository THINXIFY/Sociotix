function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-muted motion-reduce:animate-none ${className}`} />;
}

/* Mirrors the Overview layout (main column + side rail) so nothing jumps when it loads. */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[90rem] px-3 py-4 sm:px-6 sm:py-6 lg:px-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your dashboard…</span>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,23rem)] xl:gap-5">
        <div className="flex flex-col gap-3 sm:gap-4 xl:gap-5">
          <Block className="h-56" />
          <Block className="h-16" />
          <Block className="h-96" />
        </div>
        <div className="flex flex-col gap-3 sm:gap-4 xl:gap-5">
          <Block className="h-64 bg-graphite/15 dark:bg-white/5" />
          <Block className="h-24" />
          <Block className="h-56" />
        </div>
      </div>
    </div>
  );
}
