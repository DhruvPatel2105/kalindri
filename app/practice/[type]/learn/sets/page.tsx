import { SetBrowser } from "../../SetBrowser";

/** Practice: change set. (Choosing Practice goes straight to a set — this is only reached from "Change set".) */
export default async function PracticeSetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { type } = await params;
  const { page } = await searchParams;
  return <SetBrowser type={type} pageParam={page} mode="learn" />;
}
