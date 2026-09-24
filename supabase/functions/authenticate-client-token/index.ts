import { createClient } from "jsr:@supabase/supabase-js@2";
import { SignJWT } from "npm:jose@5";

interface AuthRequestBody {
  token?: unknown;
}

interface AuthResponse {
  token: string;
  clientId: string;
  expiresAt: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Duración del JWT emitido: 7 días. */
const JWT_TTL_SECONDS = 7 * 24 * 60 * 60;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuffer);

  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
      console.error(
        "Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o SUPABASE_JWT_SECRET",
      );
      return errorResponse("Configuración del servidor incompleta", 500);
    }

    // 1. Parsear body.
    let body: AuthRequestBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Body inválido", 400);
    }

    const plaintextToken = body?.token;

    if (typeof plaintextToken !== "string" || plaintextToken.length < 16) {
      return errorResponse("token inválido", 400);
    }

    // 2. Buscar el token en la DB.
    const tokenHash = await sha256Hex(plaintextToken);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: tokenRow, error: tokenError } = await supabase
      .from("client_tokens")
      .select("client_id")
      .eq("token_hash", tokenHash)
      .is("invalidated_at", null)
      .maybeSingle();

    if (tokenError) {
      console.error("Token lookup failed:", tokenError.message);
      return errorResponse("Error al verificar el token", 500);
    }

    if (!tokenRow) {
      return errorResponse("Token inválido o expirado", 401);
    }

    const clientId = tokenRow.client_id;

    // 3. Emitir JWT firmado con el secret del proyecto.
    const now = Math.floor(Date.now() / 1000);
    const exp = now + JWT_TTL_SECONDS;

    const secretKey = new TextEncoder().encode(jwtSecret);

    const jwt = await new SignJWT({
      role: "authenticated",
      client_id: clientId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(`client:${clientId}`)
      .setAudience("authenticated")
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .setIssuer(`${supabaseUrl}/auth/v1`)
      .sign(secretKey);

    const expiresAt = new Date(exp * 1000).toISOString();

    const response: AuthResponse = {
      token: jwt,
      clientId,
      expiresAt,
    };

    return jsonResponse(response, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Unhandled error:", message);
    return errorResponse("Error inesperado", 500);
  }
});
