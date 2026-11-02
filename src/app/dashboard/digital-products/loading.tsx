/** Library skeleton: the same shapes as the page, so nothing jumps when it loads. */
export default function LibraryLoading() {
  const pulse = "animate-pulse rounded-[1.4rem] bg-muted motion-reduce:animate-none dark:bg-white/[0.05]";
  return (
    <div className="mx-auto max-w-[80rem] px-3 py-4 sm:px-6 sm:py-7 lg:px-8" aria-busy="true">
      <span className="sr-only">Loading your digital library…</span>
      <div className={`${pulse} h-64 sm:h-72`} />
      <div className={`${pulse} mt-8 h-11 w-full max-w-md rounded-full`} />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${pulse} h-96`} />
        ))}
      </div>
    </div>
  );
}
