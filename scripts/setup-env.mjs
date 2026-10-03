#!/usr/bin/env node
/**
 * Crea (o completa) los archivos de entorno y secretos que NO viajan en git.
 *
 *   npm run env:init
 *
 * Nunca pisa un archivo que ya existe. Paso a paso:
 *
 *  1. Si falta `.env.local` (frontend) lo crea desde `.env.example`
 *     (queda apuntando al proyecto en la nube).
 *  2. Sincroniza la signing key ES256 del JWT de cliente entre
 *     `supabase/signing_keys.json` y `supabase/.env.local`: si existe solo
 *     uno de los dos, deriva el otro. Así, para mudarse de compu alcanza con
 *     copiar UNO de los dos.
 *  3. Si no existe ninguno de los dos, imprime cómo generar la clave por
 *     primera vez (`npx supabase gen signing-key --algorithm ES256`) y
 *     qué hacer después.
 *
 * Plantillas commiteadas (placeholders, nunca valores reales):
 *   .env.example
 *   supabase/.env.example
 *   supabase/signing_keys.example.json
 *
 * Checklist de migración de máquina: docs/entorno-y-secretos.md
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const FRONT_EXAMPLE = join(root, ".env.example");
const FRONT_FILE = join(root, ".env.local");
const SEC_EXAMPLE = join(root, "supabase", ".env.example");
const SEC_FILE = join(root, "supabase", ".env.local");
const KEYS_EXAMPLE = join(root, "supabase", "signing_keys.example.json");
const KEYS_FILE = join(root, "supabase", "signing_keys.json");

const rel = (p) => p.slice(root.length + 1).replaceAll("\\", "/");
/** @type {Array<[string, string]>} */
const report = [];
/** @type {string[]} */
const warnings = [];

function parseEnv(text) {
  const vars = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (match && match[2].trim() !== "") vars[match[1]] = match[2].trim();
  }
  return vars;
}

function jwkFromKeysFile() {
  const parsed = JSON.parse(readFileSync(KEYS_FILE, "utf8"));
  const jwk = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!jwk || typeof jwk !== "object" || !jwk.kid || !jwk.d) {
    throw new Error("signing_keys.json no contiene una JWK (falta kid o d)");
  }
  return jwk;
}

function jwkFromSecFile() {
  const vars = parseEnv(readFileSync(SEC_FILE, "utf8"));
  const raw = vars.CLIENT_JWT_PRIVATE_KEY_JWK;
  if (!raw) throw new Error("no define CLIENT_JWT_PRIVATE_KEY_JWK");
  const jwk = JSON.parse(raw);
  if (!jwk.kid || !jwk.d) throw new Error("la JWK no trae kid ni d");
  return { jwk, kid: vars.CLIENT_JWT_KID ?? "" };
}

// 1. Frontend ------------------------------------------------------------
if (existsSync(FRONT_FILE)) {
  report.push([rel(FRONT_FILE), "ok (ya existia)"]);
} else if (existsSync(FRONT_EXAMPLE)) {
  copyFileSync(FRONT_EXAMPLE, FRONT_FILE);
  report.push([
    rel(FRONT_FILE),
    "creado desde .env.example (apunta a la nube)",
  ]);
} else {
  report.push([rel(FRONT_FILE), "FALTA (no esta .env.example)"]);
}

// 2. Signing key (signing_keys.json <-> supabase/.env.local) -------------
const hasKeys = existsSync(KEYS_FILE);
const hasSec = existsSync(SEC_FILE);

if (hasKeys && hasSec) {
  report.push([rel(KEYS_FILE), "ok (ya existia)"]);
  report.push([rel(SEC_FILE), "ok (ya existia)"]);
  try {
    const fromKeys = jwkFromKeysFile();
    const fromSec = jwkFromSecFile();
    if (JSON.stringify(fromKeys) !== JSON.stringify(fromSec.jwk)) {
      warnings.push(
        `${rel(KEYS_FILE)} y ${rel(SEC_FILE)} no contienen la MISMA JWK: ` +
          "deja solo la que este Active en el panel (Auth > Signing Keys).",
      );
    } else if (fromSec.kid && fromSec.kid !== fromKeys.kid) {
      warnings.push(
        `CLIENT_JWT_KID="${fromSec.kid}" no coincide con el kid de la JWK ` +
          `"${fromKeys.kid}".`,
      );
    }
  } catch (error) {
    warnings.push(`No pude validar la signing key: ${error.message}`);
  }
} else if (hasKeys) {
  try {
    const jwk = jwkFromKeysFile();
    writeFileSync(
      SEC_FILE,
      `CLIENT_JWT_PRIVATE_KEY_JWK=${JSON.stringify(jwk)}\n` +
        `CLIENT_JWT_KID=${jwk.kid}\n`,
      "utf8",
    );
    report.push([rel(SEC_FILE), `creado desde ${rel(KEYS_FILE)}`]);
    report.push([rel(KEYS_FILE), "ok (ya existia)"]);
  } catch (error) {
    report.push([rel(SEC_FILE), `FALTA (${error.message})`]);
    report.push([rel(KEYS_FILE), "ok (pero ilegible, ver aviso)"]);
    warnings.push(`No pude derivar supabase/.env.local: ${error.message}`);
  }
} else if (hasSec) {
  try {
    const { jwk, kid } = jwkFromSecFile();
    if (kid && kid !== jwk.kid) {
      warnings.push(
        `CLIENT_JWT_KID="${kid}" no coincide con el kid de la JWK ` +
          `"${jwk.kid}"; se conserva el de la JWK.`,
      );
    }
    writeFileSync(KEYS_FILE, `${JSON.stringify([jwk], null, 2)}\n`, "utf8");
    report.push([rel(KEYS_FILE), `creado desde ${rel(SEC_FILE)}`]);
    report.push([rel(SEC_FILE), "ok (ya existia)"]);
  } catch (error) {
    report.push([rel(KEYS_FILE), `FALTA (${error.message})`]);
    report.push([rel(SEC_FILE), "ok (pero ilegible, ver aviso)"]);
    warnings.push(`No pude derivar signing_keys.json: ${error.message}`);
  }
} else {
  const falta = "FALTA (esta maquina no tiene signing key)";
  report.push([rel(KEYS_FILE), falta]);
  report.push([rel(SEC_FILE), falta]);
}

for (const example of [FRONT_EXAMPLE, SEC_EXAMPLE, KEYS_EXAMPLE]) {
  if (!existsSync(example))
    warnings.push(`Falta la plantilla ${rel(example)}.`);
}

// Docker (informativo: requisito del stack local) --------------------------
function dockerStatus() {
  const res = spawnSync(
    "docker",
    ["version", "--format", "{{.Server.Version}}"],
    {
      encoding: "utf8",
      timeout: 5000,
    },
  );
  if (res.error) {
    if (res.error.code === "ETIMEDOUT") {
      return "instalado pero no responde (daemon colgado)";
    }
    return "no detectado (instalar Docker Desktop con WSL2 / Docker Engine)";
  }
  if (res.status !== 0) {
    return "instalado pero el daemon NO corre (¿Docker Desktop abierto?)";
  }
  return `v${res.stdout.trim()} (daemon arriba)`;
}

// 3. Reporte -------------------------------------------------------------
console.log("env:init\n");
for (const [file, status] of report) {
  console.log(`  ${file.padEnd(34)} ${status}`);
}
for (const warning of warnings) console.log(`\n  AVISO: ${warning}`);
console.log(`\n  Docker: ${dockerStatus()}`);

const missingKey = !hasKeys && !hasSec;
console.log("\nSiguientes pasos:");
if (missingKey) {
  console.log("  1. Generar la signing key ES256 (solo la primera vez):");
  console.log("       npx supabase gen signing-key --algorithm ES256");
  console.log("     Eso escribe supabase/signing_keys.json; despues:");
  console.log("       npm run env:init     # deriva supabase/.env.local");
  console.log("     y en la nube (docs/decisiones/20261001-cliente-jwt-...):");
  console.log("       panel Auth > Signing Keys -> clave Active");
  console.log("       npx supabase secrets set --env-file supabase/.env.local");
  console.log("       npx supabase functions deploy authenticate-client-token");
} else {
  console.log("  npm run dev              # frontend");
  console.log("  npm run supabase:start   # stack local (Docker)");
  console.log("  npm run env:cloud        # frontend -> nube");
}
console.log("\nDetalle: docs/entorno-y-secretos.md");
