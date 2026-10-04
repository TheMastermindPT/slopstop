import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const repository = new URL("../../../../", import.meta.url).href;
function isLocalJavascript(specifier, parentURL) {
  return (
    parentURL?.startsWith(repository) && specifier.startsWith(".") && specifier.endsWith(".js")
  );
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (isLocalJavascript(specifier, context.parentURL)) {
      const javascript = new URL(specifier, context.parentURL);
      const typescript = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
      if (!existsSync(javascript) && existsSync(typescript))
        return nextResolve(typescript.href, context);
    }
    return nextResolve(specifier, context);
  },
});
