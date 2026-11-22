import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TitleBar } from "./title-bar.js";

describe("the title bar", () => {
  it("shows the Raidho mark and the Ragnarok heading", () => {
    const { container } = render(<TitleBar />);
    const banner = screen.getByRole("banner");
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(within(banner).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    within(banner).getByRole("heading", { level: 1, name: "Ragnarok" });
    const marks = banner.querySelectorAll("svg");
    expect(marks).toHaveLength(1);
    const mark = marks[0];
    expect({
      ariaHidden: mark?.getAttribute("aria-hidden"),
      focusable: mark?.getAttribute("focusable"),
      viewBox: mark?.getAttribute("viewBox"),
      width: mark?.getAttribute("width"),
      height: mark?.getAttribute("height"),
      paths: [...(mark?.querySelectorAll("path") ?? [])].map((path) => path.getAttribute("d")),
    }).toEqual({
      ariaHidden: "true",
      focusable: "false",
      viewBox: "-1.5 -1.5 10 19",
      width: "11",
      height: "21",
      paths: ["M 0 0 L 0 16 M 0 0 L 7 4 L 0 8 L 7 16"],
    });
    expect(container.querySelectorAll("button, a, input, [tabindex]")).toHaveLength(0);
    expect(banner.textContent).toBe("Ragnarok");
  });
});

it("SH-B25: names the brand for the skip button rule, with an empty value", () => {
  const banner = render(<TitleBar />).container.querySelector("header");
  const brand = banner?.querySelector("svg")?.parentElement;
  expect(brand?.getAttribute("data-title-bar-brand")).toBe("");
});

describe("the open Project's name in the bar", () => {
  it("SH-B17: writes the name as text, never as markup", () => {
    const name = '<img src=x onerror=alert(1)> & "b"';
    render(<TitleBar projectName={name} onShowProjects={() => undefined} />);
    const banner = screen.getByRole("banner");
    const button = within(banner).getByRole("button");
    expect([button.textContent, button.getAttribute("aria-label")]).toEqual([
      name,
      `Project ${name}`,
    ]);
    expect(banner.querySelectorAll("img")).toHaveLength(0);
  });
});
