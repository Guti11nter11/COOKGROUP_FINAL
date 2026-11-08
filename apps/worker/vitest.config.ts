import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    test: {
      include: ["test/**/*.test.ts"],
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          isolatedStorage: true,
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            bindings: { TEST_MIGRATIONS: migrations, TICKETMASTER_API_KEY: "test-key", DISCORD_BOT_TOKEN: "test-token", DELIVERY_PAUSED: "0",
              // Clave pública de pruebas (la privada solo está en test/interactions.test.ts).
              DISCORD_PUBLIC_KEY: "ff83de1af4d440a473ff29e34c36df14f87af04baa3f72b3055fe5c8bd08c45b" },
          },
        },
      },
    },
  };
});
