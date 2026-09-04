import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/storage/runtime-schema.ts",
  out: "./drizzle/runtime",
});
