import { expect, it } from "vitest";
import { openRequest } from "./project-storage-open-fixture.js";
import {
  createTemporaryApplicationRoot,
  createUpgradeStorageOwner,
  projectStorageIntegrationTimeout,
} from "./project-storage-runtime-fixture.js";
import { createGenerationTwoProject } from "./project-storage-upgrade-fixture.js";

it("upgrades a generation-two Project in under two seconds", {
  timeout: projectStorageIntegrationTimeout,
}, async () => {
  const root = await createTemporaryApplicationRoot();
  await createGenerationTwoProject(root);
  const fixture = createUpgradeStorageOwner(root);
  try {
    const started = performance.now();
    const outcome = await fixture.upgrade(openRequest);
    const elapsed = performance.now() - started;
    console.info(`generation-two upgrade: ${Math.round(elapsed)} ms`);
    expect(outcome).toMatchObject({ status: "ready", result: { status: "upgraded" } });
    expect(elapsed).toBeLessThan(2000);
  } finally {
    await fixture.owner.stop();
  }
});
