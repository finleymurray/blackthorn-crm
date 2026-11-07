import { defineConfig } from "vitest/config";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

/** Reads .env.local so the database backed tests can find DATABASE_URL. */
function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of [".env.local", ".env"]) {
    const p = path.resolve(__dirname, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !line.trim().startsWith("#")) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    env: loadEnv(),
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
