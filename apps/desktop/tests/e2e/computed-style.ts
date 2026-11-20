import type { Page } from "@playwright/test";

/** A style property the probe reads. */
export type ProbedProperty = "backgroundColor" | "boxShadow" | "borderTopColor";

/** `value` as the page computes it for `property`, read from a probe element. */
export function computedValue(page: Page, property: ProbedProperty, value: string) {
  return page.evaluate(
    ({ property, value }) => {
      const probe = document.createElement("div");
      probe.style[property] = value;
      document.body.append(probe);
      const computed = getComputedStyle(probe)[property];
      probe.remove();
      return computed;
    },
    { property, value },
  );
}
