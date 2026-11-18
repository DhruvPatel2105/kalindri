import { AppNav } from "../_components/AppNav";

/** The navigation bar above every practice page (question types, set lists, tests, results, history, progress). */
export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      {children}
    </>
  );
}
