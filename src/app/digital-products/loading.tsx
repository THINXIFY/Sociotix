/** Skeleton shown while the marketplace loads: same silhouette as the page, so nothing jumps when it arrives. */
export default function Loading() {
  const bar = "animate-pulse rounded-full bg-muted motion-reduce:animate-none";
  return (
    <div aria-busy="true" aria-label="Loading digital products" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-4 py-14 sm:py-16">
        <div className={`${bar} h-7 w-44`} />
        <div className={`${bar} h-12 w-full max-w-xl`} />
        <div className={`${bar} h-14 w-full max-w-xl`} />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`${bar} h-10 w-36 shrink-0`} />
        ))}
      </div>
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border">
            <div className="aspect-[16/9] animate-pulse bg-muted motion-reduce:animate-none" />
            <div className="space-y-3 p-5">
              <div className={`${bar} h-3 w-20`} />
              <div className={`${bar} h-5 w-4/5`} />
              <div className={`${bar} h-4 w-full`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
