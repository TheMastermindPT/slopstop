import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { decodeStrict, RegisteredProjectSchema } from "@slopstop/protocol";
import { expect, it } from "vitest";
import { createProjectRegistrationOwner } from "../../src/registration/project-registration-owner.js";
import { RepositoryTrustDecisionSchema } from "../../src/registration/repository-trust.js";
import { createControlledIdentityConsent } from "./registration-consent-fixture.js";

// Invoked only by the Electron E2E fixture, never a fake renderer data source.
it.runIf(process.env["PC_UI_USER_DATA"] !== undefined)(
  "seeds real registered Projects for the Electron entry journey",
  async () => {
    const root = process.env["PC_UI_USER_DATA"];
    if (root === undefined) throw new Error("Missing disposable userData root");
    await mkdir(root, { recursive: true });
    const options = {
      applicationStorageRoot: path.join(root, "storage"),
      migrationResourcesRoot: path.resolve(import.meta.dirname, "../../drizzle"),
      applicationVersion: "0.0.0",
    };
    const git = path.join(process.env["ProgramFiles"] ?? "C:/Program Files", "Git/cmd/git.exe");
    const projects = [];
    for (const name of ["repository-a", "repository-b"]) {
      const directory = path.join(root, name);
      execFileSync(git, ["init", "--quiet", directory]);
      const scenario = await createControlledIdentityConsent(
        root,
        { select: async () => ({ status: "selected", directory }) },
        git,
        options,
      );
      const owner = createProjectRegistrationOwner(scenario.registry, options, root);
      try {
        const selected = await scenario.registry.selectRepository();
        if (selected.status !== "prepared") throw new Error("No selection");
        const trust = {
          repositorySelectionId: selected.repositorySelectionId,
          trustId: randomUUID(),
        };
        expect(
          await scenario.registry.decideRepositoryTrust(
            decodeStrict(RepositoryTrustDecisionSchema, { ...trust, decision: "accepted" }),
          ),
        ).toEqual({ status: "recorded" });
        expect(
          await scenario.registry.decideIdentityQueries({
            ...scenario.request,
            decision: "accepted",
          }),
        ).toEqual({ status: "recorded" });
        const preparation = {
          version: 1,
          requestId: randomUUID(),
          admission: { ...scenario.request, ...trust },
        };
        const proposal = await owner.prepare(preparation);
        if (proposal.status !== "prepared") throw new Error("No proposal");
        projects.push(
          decodeStrict(
            RegisteredProjectSchema,
            await owner.confirm({
              version: 1,
              requestId: randomUUID(),
              preparation,
              proposalId: proposal.proposalId,
              proposalFingerprint: proposal.proposalFingerprint,
            }),
          ),
        );
      } finally {
        await owner.close();
        await scenario.observer.close();
        await scenario.registry.stop();
      }
    }
    await writeFile(path.join(root, "fixture-projects.json"), JSON.stringify(projects));
  },
);
