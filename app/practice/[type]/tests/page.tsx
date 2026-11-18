import { SetBrowser } from "../SetBrowser";

/** Test: pick a set to sit as a test (the original flow, unchanged). */
export default async function TestSetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { type } = await params;
  const { page } = await searchParams;
  return <SetBrowser type={type} pageParam={page} mode="test" />;
}
