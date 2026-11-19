import { PageSkeleton } from "./_components/Skeleton";

/** Shown instantly while the home dashboard's data loads. */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <PageSkeleton />
    </div>
  );
}
