import { SetBrowser } from "../SetBrowser";

/** Test: choose how many questions (out of all of the type's questions) and sit them as a test. */
export default async function TestStartPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  return <SetBrowser type={type} mode="test" />;
}
