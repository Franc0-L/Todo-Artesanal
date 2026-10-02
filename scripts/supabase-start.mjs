#!/usr/bin/env node
/**
 * Arranca el stack local de Supabase con los secretos de las Edge Functions
 * disponibles para la resolución de `env(VAR)` de `[edge_runtime.secrets]`.
 *
 * Uso: npm run supabase:start
 *
 * Lee `supabase/.env.local` (gitignored) y lo exporta al entorno del proceso
 * antes de invocar a la CLI. Sin esas variables, `supabase start` termina
 * OK igualmente, pero `authenticate-client-token` falla con
 * "Configuración del servidor incompleta: falta ..." — por eso acá se corta
 * de arranque si falta el archivo.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, "supabase", ".env.local");

if (!existsSync(envFile)) {
  console.error(`Falta ${envFile}`);
  console.error(
    "Debe definir CLIENT_JWT_PRIVATE_KEY_JWK=<jwk privada> y CLIENT_JWT_KID=<kid>.",
  );
  console.error('Ver README -> "Probar localmente".');
  process.exit(1);
}

let loaded = 0;
for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (match && match[2] !== "") {
    process.env[match[1]] = match[2];
    loaded += 1;
  }
}

if (loaded === 0) {
  console.error(`${envFile} no define ninguna variable.`);
  process.exit(1);
}

console.log(`Secretos cargados desde supabase/.env.local: ${loaded}`);

const child = spawn("npx supabase start", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
