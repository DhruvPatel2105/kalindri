import { AppNav } from "../_components/AppNav";

/** The navigation bar above every mock-test page. */
export default function MockLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      {children}
    </>
  );
}
