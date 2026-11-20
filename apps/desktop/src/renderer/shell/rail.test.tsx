import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Rail } from "./rail.js";

/** The Runa v2 paths (`ragnarok-hero/icons-runa-v2/folder.svg` and `flame.svg`). */
const folder = "M3 5.5H9L12 8.5H21V19H3Z";
const flame = "M15.5 4L7.5 12L15.5 20M16 10L18 12L16 14L14 12Z";

describe("the activity rail", () => {
  it("SH-B1: offers Projects and Attention as labelled destinations", async () => {
    const onSelect = vi.fn();
    render(<Rail current="projects" onSelect={onSelect} />);
    const rail = within(screen.getByRole("navigation", { name: "Activity" }));
    const buttons = rail.getAllByRole("button");
    expect(
      buttons.map((button) => button.getAttribute("aria-label") ?? button.textContent),
    ).toEqual(["Projects", "Attention"]);
    const [projects, attention] = buttons;
    expect(rail.getByRole("button", { name: "Projects" })).toBe(projects);
    expect(rail.getByRole("button", { name: "Attention" })).toBe(attention);
    expect(projects?.getAttribute("aria-pressed")).toBe("true");
    expect(attention?.getAttribute("aria-pressed")).toBe("false");
    for (const [button, path, label] of [
      [projects, folder, "Projects"],
      [attention, flame, "Attention"],
    ] as const) {
      const icons = [...(button?.querySelectorAll("svg") ?? [])];
      expect(icons.map((icon) => icon.getAttribute("aria-hidden"))).toEqual(["true"]);
      expect(icons[0]?.querySelector("path")?.getAttribute("d")).toBe(path);
      // The label is the button's only text: no count on Attention (Q2).
      expect(button?.textContent).toBe(label);
    }
    await userEvent.setup().click(rail.getByRole("button", { name: "Attention" }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("attention");
  });
});
