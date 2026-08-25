import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PrototypeApp } from "./prototype-app.js";

describe("workspace supervision prototype", () => {
  it("starts with human attention and keeps a deterministic route back to the map", async () => {
    const user = userEvent.setup();
    render(<PrototypeApp />);

    expect(screen.getByRole("navigation", { name: "Attention" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Relationship map" })).not.toBeNull();

    const workspaceTabs = screen.getByRole("tablist", { name: "Open workspace surfaces" });
    expect(within(workspaceTabs).getByRole("tab", { name: "Map" })).not.toBeNull();
    expect(within(workspaceTabs).getByRole("tab", { name: "Conversation" })).not.toBeNull();

    const contextTabs = screen.getByRole("tablist", { name: "Context pages" });
    expect(within(contextTabs).queryByRole("tab", { name: "Conversation" })).toBeNull();
    expect(within(contextTabs).getByRole("tab", { name: "Details" })).not.toBeNull();
    expect(within(contextTabs).getByRole("tab", { name: "Evidence" })).not.toBeNull();
    expect(within(contextTabs).getByRole("tab", { name: "Changes" })).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Files" }));
    await user.click(screen.getByRole("treeitem", { name: "session-store.ts" }));

    expect(screen.getByRole("heading", { name: "session-store.ts" })).not.toBeNull();
    expect(screen.queryByText("Attached: session-store.ts")).toBeNull();

    await user.click(within(workspaceTabs).getByRole("tab", { name: "Conversation" }));
    expect(screen.getByRole("heading", { name: "Frame the product" })).not.toBeNull();
    expect(screen.queryByRole("complementary", { name: "Context workbench" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Attach current file" }));
    expect(screen.getByText("Attached: session-store.ts")).not.toBeNull();

    await user.click(within(workspaceTabs).getByRole("tab", { name: "Map" }));
    expect(screen.getByRole("heading", { name: "Relationship map" })).not.toBeNull();
  });

  it("separates provisional Worker changes from an actionable Candidate delta", async () => {
    const user = userEvent.setup();
    render(<PrototypeApp />);

    await user.click(screen.getByRole("button", { name: "Runs" }));
    await user.click(screen.getByRole("button", { name: /Run 42/i }));
    await user.click(screen.getByRole("button", { name: "View live changes" }));

    expect(screen.getByText("Provisional diff")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Approve integration" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Runs" }));
    await user.click(screen.getByRole("button", { name: /Run 41/i }));
    await user.click(screen.getByRole("button", { name: "Review candidate" }));

    expect(screen.getByText("Candidate delta ready")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Approve integration" })).not.toBeNull();
  });

  it("keeps logs scoped and conversation scope explicit", async () => {
    const user = userEvent.setup();
    render(<PrototypeApp />);

    await user.click(screen.getByRole("button", { name: "Runs" }));
    await user.click(screen.getByRole("button", { name: /Run 42/i }));
    await user.click(screen.getByRole("button", { name: "Open logs" }));

    const logs = screen.getByRole("region", { name: "Logs and output" });
    expect(within(logs).getByRole<HTMLSelectElement>("combobox", { name: "Log scope" }).value).toBe(
      "run-42",
    );

    await user.click(screen.getByRole("tab", { name: "Conversation" }));
    expect(
      screen.getByRole("button", { name: "Open conversation navigator" }).textContent,
    ).toContain("Waypoint · Session storage");

    await user.click(screen.getByRole("button", { name: "Open conversation navigator" }));
    const navigator = screen.getByRole("dialog", { name: "Conversation navigator" });
    await user.click(within(navigator).getByRole("button", { name: /^Project · MaxReps/ }));
    expect(
      screen.getByRole("button", { name: "Open conversation navigator" }).textContent,
    ).toContain("Project · MaxReps");
  });

  it("reviews branch influence, Frame, and Memory without pretending to persist them", async () => {
    const user = userEvent.setup();
    render(<PrototypeApp />);

    await user.click(screen.getByRole("tab", { name: "Conversation" }));
    await user.click(screen.getByRole("button", { name: "Open conversation navigator" }));

    const navigator = screen.getByRole("dialog", { name: "Conversation navigator" });
    await user.click(
      within(navigator).getByRole("button", {
        name: "Waypoint · Session storage / Resume after refresh / Suspension edge cases",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Open conversation navigator" }).textContent,
    ).toContain("Suspension edge cases");

    const proposal = screen.getByRole("region", { name: "Context proposal" });
    expect(within(proposal).getByText("Rest-session recovery contract")).not.toBeNull();
    await user.click(within(proposal).getByRole("button", { name: "Review branch influence" }));

    const influence = screen.getByRole("dialog", { name: "Review branch influence" });
    const staleNotes = within(influence).getByRole("checkbox", {
      name: "Include stale timer notes",
    });
    expect((staleNotes as HTMLInputElement).checked).toBe(false);
    await user.click(staleNotes);
    await user.click(within(influence).getByRole("button", { name: "Use this selection" }));
    expect(within(proposal).getByText("Stale timer notes")).not.toBeNull();

    await user.type(screen.getByRole("textbox", { name: "Message" }), "Keep the failure visible.");
    await user.click(screen.getByRole("button", { name: "Send to model" }));
    expect(screen.getByText("The failure remains a separate observable outcome.")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Inspect context record" }));
    const record = screen.getByRole("region", { name: "Context record" });
    expect(within(record).getByText("Included exactly")).not.toBeNull();
    expect(within(record).getByText("Excluded exactly")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Review Frame" }));
    expect(screen.getByRole("heading", { name: "Review the Frame" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "User stories" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Traceable Mirror" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Return to Conversation" }));
    expect(screen.getByRole("heading", { name: "Frame the product" })).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Open Project menu" }));
    const projectMenu = screen.getByRole("menu", { name: "Project menu" });
    await user.click(within(projectMenu).getByRole("menuitem", { name: /Memory library/i }));
    expect(screen.getByRole("heading", { name: "Project Memory" })).not.toBeNull();
    expect(screen.getByText("Accepted", { selector: "span" })).not.toBeNull();
    expect(screen.getByText("Stale", { selector: "span" })).not.toBeNull();
    expect(screen.getByText("Proposal", { selector: "span" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Return to Conversation" }));

    await user.click(screen.getByRole("button", { name: "Review Frame" }));
    await user.click(screen.getByRole("button", { name: "Accept Frame revision" }));
    expect(screen.getByRole("heading", { name: "Relationship map" })).not.toBeNull();
    expect(screen.getByRole("status").textContent).toContain(
      "Accepted revision generated this map",
    );
  });
});
