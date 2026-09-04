import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/storage/canonical-schema.ts",
  out: "./drizzle/canonical",
});
