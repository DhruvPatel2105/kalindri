import { PageSkeleton } from "../_components/Skeleton";

/**
 * Shown instantly under the navigation bar while any practice page loads —
 * set lists, tests, Practice, results, review, history and dashboards.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <PageSkeleton />
    </div>
  );
}
