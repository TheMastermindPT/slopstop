import ts from "typescript";

const nativeAddon = "fs-native-extensions";

function skipParentheses(node) {
  let current = node;
  while (ts.isParenthesizedExpression(current.parent)) current = current.parent;
  return current;
}

/** A function invoked where it is defined, `(function () { ... })()`, runs at load time. */
function isImmediatelyInvoked(node) {
  if (!ts.isFunctionExpression(node) && !ts.isArrowFunction(node)) return false;
  const outer = skipParentheses(node);
  return ts.isCallExpression(outer.parent) && outer.parent.expression === outer;
}

/** A class static block runs with its class declaration, so it is not a deferred scope. */
function isDeferredScope(node) {
  return ts.isFunctionLike(node) && !isImmediatelyInvoked(node);
}

function requiredSpecifier(node) {
  if (!ts.isCallExpression(node) || node.arguments.length !== 1) return undefined;
  const [argument] = node.arguments;
  const literal = ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument);
  return ts.isIdentifier(node.expression) && node.expression.text === "require" && literal
    ? argument.text
    : undefined;
}

/**
 * The `require` specifiers a CommonJS chunk evaluates while it loads: outside any function,
 * except functions invoked where they are defined. A function called later during loading (for
 * example a bundler's lazy module initializer) is treated as deferred.
 */
export function loadTimeRequires(source) {
  const file = ts.createSourceFile("chunk.cjs", source, ts.ScriptTarget.Latest, true);
  const specifiers = [];
  const visit = (node) => {
    if (isDeferredScope(node)) return;
    const specifier = requiredSpecifier(node);
    if (specifier !== undefined) specifiers.push(specifier);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return specifiers;
}

/**
 * Whether loading `entry` loads the native addon: `loads-addon` with the chain of chunks that
 * reach it, `deferred` when it is only loaded later, or `no-load-time-requires` when the entry
 * requires nothing while it loads, which a bundled entry always does, so the check could not run.
 */
export function nativeAddonLoadOrder(entry, readChunk) {
  const visited = new Set();
  const walk = (name) => {
    if (visited.has(name)) return undefined;
    visited.add(name);
    for (const specifier of loadTimeRequires(readChunk(name))) {
      if (specifier === nativeAddon) return [name, nativeAddon];
      if (!specifier.startsWith("./")) continue;
      const chain = walk(specifier.slice(2));
      if (chain !== undefined) return [name, ...chain];
    }
    return undefined;
  };
  if (loadTimeRequires(readChunk(entry)).length === 0) return { status: "no-load-time-requires" };
  const chain = walk(entry);
  return chain === undefined ? { status: "deferred" } : { status: "loads-addon", chain };
}
