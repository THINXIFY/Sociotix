import { Suspense } from "react";

/**
 * Reads a route's `params` / `searchParams` inside a Suspense boundary, so the page shell can render instantly and
 * Next.js doesn't flag URL data being read during prerendering. The page's own loader shows the loading state.
 */
async function Read<T>({ value, children }: { value: Promise<T>; children: (v: T) => React.ReactNode }) {
  return <>{children(await value)}</>;
}

export function Resolve<T>({ value, children }: { value: Promise<T>; children: (v: T) => React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Read value={value}>{children}</Read>
    </Suspense>
  );
}
