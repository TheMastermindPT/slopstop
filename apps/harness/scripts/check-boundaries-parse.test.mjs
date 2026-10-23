import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cruise } from "dependency-cruiser";
import extractDepcruiseConfig from "dependency-cruiser/config-utl/extract-depcruise-config";
import extractTSConfig from "dependency-cruiser/config-utl/extract-ts-config";
import { afterEach, beforeEach, expect, it } from "vitest";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const desktop = "apps/desktop/src/a.ts";
let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "slopstop-boundaries-parse-"));
  copyFileSync(join(repository, "tsconfig.base.json"), join(root, "tsconfig.base.json"));
  write("apps/harness/src/b.ts", "export const x = 1;\nexport type X = number;\n");
  write("apps/desktop/src/c.ts", "export const y = 2;\n");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

async function cruiseFixture() {
  const config = await extractDepcruiseConfig(join(repository, "dependency-cruiser.config.cjs"));
  const result = await cruise(
    ["apps"],
    { ...config.options, validate: true, ruleSet: config, baseDir: root },
    {},
    { tsConfig: extractTSConfig(join(root, "tsconfig.base.json")) },
  );
  return result.output;
}

function violationsOf(output) {
  return output.summary.violations.map(({ rule, from, to }) => ({ rule: rule.name, from, to }));
}

const forbidden = [{ rule: "no-app-to-app-imports", from: desktop, to: "apps/harness/src/b.ts" }];

it.each([
  {
    name: "value import",
    source: 'import { x } from "../../harness/src/b.ts";\nexport const z = x;\n',
    target: "apps/harness/src/b.ts",
    violations: forbidden,
  },
  {
    name: "allowed",
    source: 'import { y } from "./c.ts";\nexport const z = y;\n',
    target: "apps/desktop/src/c.ts",
    violations: [],
  },
])("reports a forbidden TypeScript import: $name", async ({ source, target, violations }) => {
  write(desktop, source);

  const output = await cruiseFixture();

  expect(violationsOf(output)).toEqual(violations);
  expect(output.modules.map(({ source }) => source)).toContain(target);
});
