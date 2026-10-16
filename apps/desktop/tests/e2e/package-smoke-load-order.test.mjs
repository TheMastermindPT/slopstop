import { describe, expect, it } from "vitest";
import { loadTimeRequires, nativeAddonLoadOrder } from "./package-smoke-load-order.mjs";

/** Reads synthetic chunks by name; a missing chunk fails the test. */
function chunks(sources) {
  return (name) => {
    const source = sources[name];
    if (source === undefined) throw new Error(`Unknown chunk ${name}.`);
    return source;
  };
}

describe("loadTimeRequires", () => {
  it("lists top-level requires, requires in immediately invoked functions and in top-level static blocks", () => {
    const source = [
      'const protocol = require("./protocol.cjs");',
      '(function () { require("./iife.cjs"); })();',
      '(() => require("./arrow.cjs"))();',
      'function later() { return require("./later.cjs"); }',
      'const lazy = () => require("./lazy.cjs");',
      'class Owner { static { require("./static.cjs"); } }',
    ].join("\n");
    expect(loadTimeRequires(source)).toEqual([
      "./protocol.cjs",
      "./iife.cjs",
      "./arrow.cjs",
      "./static.cjs",
    ]);
  });
});

describe("nativeAddonLoadOrder", () => {
  it("reports the chain of chunks that loads the addon while the entry loads", () => {
    const read = chunks({
      "entry.cjs": 'require("./runtime.cjs"); require("./store.cjs");',
      "runtime.cjs": "module.exports = {};",
      "store.cjs": 'const native = require("fs-native-extensions");',
    });
    expect(nativeAddonLoadOrder("entry.cjs", read)).toEqual({
      status: "loads-addon",
      chain: ["entry.cjs", "store.cjs", "fs-native-extensions"],
    });
  });

  it("reports an addon loaded only by a deferred require as deferred", () => {
    const read = chunks({
      "entry.cjs": 'require("./runtime.cjs"); async function start() { require("./store.cjs"); }',
      "runtime.cjs": "module.exports = {};",
    });
    expect(nativeAddonLoadOrder("entry.cjs", read)).toEqual({ status: "deferred" });
  });

  it("reports an addon loaded inside an immediately invoked function", () => {
    const read = chunks({
      "entry.cjs": '(function () { require("fs-native-extensions"); })();',
    });
    expect(nativeAddonLoadOrder("entry.cjs", read)).toEqual({
      status: "loads-addon",
      chain: ["entry.cjs", "fs-native-extensions"],
    });
  });

  it("reports an entry that requires nothing while it loads as a distinct result", () => {
    const read = chunks({ "entry.cjs": 'function start() { require("./store.cjs"); }' });
    expect(nativeAddonLoadOrder("entry.cjs", read)).toEqual({ status: "no-load-time-requires" });
  });

  it("follows each chunk once through a require cycle", () => {
    const read = chunks({
      "entry.cjs": 'require("./a.cjs");',
      "a.cjs": 'require("./b.cjs");',
      "b.cjs": 'require("./a.cjs");',
    });
    expect(nativeAddonLoadOrder("entry.cjs", read)).toEqual({ status: "deferred" });
  });
});
