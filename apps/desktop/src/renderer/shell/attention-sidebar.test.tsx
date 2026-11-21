import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttentionSidebar } from "./attention-sidebar.js";

describe("the Attention sidebar", () => {
  it("SH-B14: shows its name, the rune rule and the honest line, and nothing like a list or a count", () => {
    render(<AttentionSidebar />);
    const region = screen.getByRole("complementary", { name: "Attention" });
    const headings = within(region).getAllByRole("heading");
    expect(headings.map((heading) => [heading.tagName, heading.textContent])).toEqual([
      ["H2", "Attention"],
    ]);
    // The rule is decoration: one element, hidden from assistive technology, with no text.
    const hidden = [...region.querySelectorAll('[aria-hidden="true"]')];
    expect(hidden.map((element) => element.textContent)).toEqual([""]);
    expect(within(region).getByText("Attention has no sources yet.")).toBeTruthy();
    expect({
      lists: within(region).queryAllByRole("list").length,
      links: within(region).queryAllByRole("link").length,
      buttons: within(region).queryAllByRole("button").length,
      digits: /\d/.test(region.textContent ?? ""),
    }).toEqual({ lists: 0, links: 0, buttons: 0, digits: false });
  });
});
