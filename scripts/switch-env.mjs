#!/usr/bin/env node
/**
 * Cambia a dónde apunta el frontend en `.env.local`.
 *
 *   npm run env:local  -> stack local de Docker (http://127.0.0.1:54321)
 *   npm run env:cloud  -> proyecto Supabase en la nube
 *
 * La clave local no está escrita a mano: se lee de `supabase status -o env`
 * para que no se desincronice si la CLI regenera el publishable key.
 */
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, ".env.local");

const CLOUD = {
  VITE_SUPABASE_URL: "https://zarvihhrzfcvlegqygnu.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_oXj8-cX7Nd1KEnyKLpZ5kg_nExCU3yr",
};

function localEnv() {
  const res = spawnSync("npx supabase status -o env", {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });

  const out = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
  const match = out.match(/^PUBLISHABLE_KEY="?([^"\r\n]+)"?/m);

  if (!match) {
    console.error(
      "No se pudo leer PUBLISHABLE_KEY de `supabase status -o env`.",
    );
    console.error(
      "¿Está levantado el stack local? Si no: npm run supabase:start",
    );
    process.exit(1);
  }

  return {
    VITE_SUPABASE_URL: "http://127.0.0.1:54321",
    VITE_SUPABASE_ANON_KEY: match[1],
  };
}

const target = process.argv[2];
if (target !== "local" && target !== "cloud") {
  console.error("Uso: node scripts/switch-env.mjs <local|cloud>");
  process.exit(1);
}

const vars = target === "local" ? localEnv() : CLOUD;
const body = Object.entries(vars)
  .map(([k, v]) => `${k}=${v}`)
  .join("\n");

writeFileSync(envFile, `${body}\n`, "utf8");

console.log(`.env.local -> ${target}`);
for (const [k, v] of Object.entries(vars)) {
  console.log(`  ${k}=${v}`);
}
