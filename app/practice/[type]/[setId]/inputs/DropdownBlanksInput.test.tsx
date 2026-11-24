import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DropdownBlanksInput } from "./DropdownBlanksInput";

const parts = ["Riders ", " the pass and ", " a receipt."];

describe("DropdownBlanksInput", () => {
  it("shows a dropdown for a blank with choices and a text box for one without", () => {
    render(
      <DropdownBlanksInput
        parts={parts}
        blanks={[{ options: ["renew", "renews", "renewed", "renewing"] }, { options: null }]}
        value={["", ""]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Blank 1" })).toBeInTheDocument();
    const box = screen.getByRole("textbox", { name: /Blank 2/ });
    expect(box).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Blank 2" })).not.toBeInTheDocument();
  });

  it("reports typed text and chosen options in the right blank, keeping the other blank's value", async () => {
    const onChange = vi.fn();
    render(
      <DropdownBlanksInput
        parts={parts}
        blanks={[{ options: ["renew", "renews", "renewed", "renewing"] }, { options: null }]}
        value={["renew", ""]}
        onChange={onChange}
      />,
    );
    await userEvent.type(screen.getByRole("textbox", { name: /Blank 2/ }), "K");
    expect(onChange).toHaveBeenLastCalledWith(["renew", "K"]);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Blank 1" }), "renews");
    expect(onChange).toHaveBeenLastCalledWith(["renews", ""]);
  });

  it("shows what was typed and can be disabled", () => {
    render(
      <DropdownBlanksInput parts={parts} blanks={[{ options: null }, { options: null }]} value={["renew", "Keep"]} onChange={() => {}} disabled />,
    );
    const boxes = screen.getAllByRole("textbox");
    expect(boxes).toHaveLength(2);
    expect(boxes[1]).toHaveValue("Keep");
    expect(boxes[0]).toBeDisabled();
  });
});
