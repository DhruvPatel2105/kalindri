import { SetBrowser } from "../SetBrowser";

/** Practice: choose how many questions (out of all of the type's questions) to practise. */
export default async function PracticeStartPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  return <SetBrowser type={type} mode="practice" />;
}
