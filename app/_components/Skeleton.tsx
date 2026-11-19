/**
 * Placeholder blocks shown while a page's data loads, so a click gets an
 * immediate response instead of a frozen screen. Purely visual; screen
 * readers hear "Loading…".
 */

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-[#e6e2d9] ${className}`} />;
}

/** A row of stat cards, as on the dashboards. */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded border border-[#ddd9d0] bg-white px-4 py-3">
          <Bar className="h-3 w-20" />
          <Bar className="mt-2 h-6 w-14" />
        </div>
      ))}
    </div>
  );
}

/** The "Your progress" section of the home page while it loads. */
export function ProgressSkeleton() {
  return (
    <section aria-busy="true" aria-label="Your progress" className="mb-10 flex flex-col gap-5">
      <span className="sr-only">Loading your progress…</span>
      <Bar className="h-5 w-36" />
      <StatsSkeleton count={6} />
      <div className="rounded border border-[#ddd9d0] bg-white px-6 py-5">
        <Bar className="h-4 w-40" />
        <Bar className="mt-4 h-28 w-full" />
      </div>
    </section>
  );
}

/** A generic page: heading, a row of cards and a list. Used by loading.tsx files. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <span className="sr-only">Loading…</span>
      <div>
        <Bar className="h-6 w-56" />
        <Bar className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <StatsSkeleton />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-[#ddd9d0] bg-white px-4 py-4">
            <div className="flex-1">
              <Bar className="h-4 w-2/3" />
              <Bar className="mt-2 h-3 w-1/3" />
            </div>
            <Bar className="ml-4 h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
