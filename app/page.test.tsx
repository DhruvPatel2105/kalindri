import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import HomePage from "@/app/page";

test("home page renders the Kalindri placeholder", () => {
  render(<HomePage />);
  expect(screen.getByRole("main")).toHaveTextContent("Kalindri");
});
