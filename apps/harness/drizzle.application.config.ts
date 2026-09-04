import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/storage/application-schema.ts",
  out: "./drizzle/application",
});
