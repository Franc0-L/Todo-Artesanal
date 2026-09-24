import { createClient } from "jsr:@supabase/supabase-js@2";

interface RotateRequestBody {
  clientId?: unknown;
}

interface RotateResponse {
  token: string;
  clientId: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * base64url sin padding: URL-safe y sin '='.
 * 32 bytes random → ~43 caracteres.
 */
function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse("Configuración del servidor incompleta", 500);
  }

  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse("Falta el token de autenticación", 401);
  }

  const jwt = authHeader.slice(7);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 1. Verificar JWT y obtener el caller.
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);

  if (userError || !userData.user) {
    return errorResponse("Token inválido o expirado", 401);
  }

  const callerId = userData.user.id;

  // 2. Verificar que el caller es admin.
  const { data: adminRow, error: adminError } = await supabase
    .schema("private")
    .from("admin_users")
    .select("user_id")
    .eq("user_id", callerId)
    .maybeSingle();

  if (adminError) {
    return errorResponse("Error al verificar permisos", 500);
  }

  if (!adminRow) {
    return errorResponse("Solo administradores pueden rotar tokens", 403);
  }

  // 3. Parsear body.
  let body: RotateRequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Body inválido", 400);
  }

  const clientId = body?.clientId;

  if (typeof clientId !== "string" || !UUID_REGEX.test(clientId)) {
    return errorResponse("clientId debe ser un UUID válido", 400);
  }

  // 4. Verificar que el cliente existe.
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    return errorResponse("Error al buscar cliente", 500);
  }

  if (!clientRow) {
    return errorResponse("Cliente no encontrado", 404);
  }

  // 5. Invalidar token vigente (si existe).
  const now = new Date().toISOString();

  const { error: invalidateError } = await supabase
    .from("client_tokens")
    .update({ invalidated_at: now })
    .eq("client_id", clientId)
    .is("invalidated_at", null);

  if (invalidateError) {
    return errorResponse("Error al invalidar token anterior", 500);
  }

  // 6. Generar y persistir el nuevo token (solo el hash).
  const plaintextToken = generateToken();
  const tokenHash = await sha256Hex(plaintextToken);

  const { error: insertError } = await supabase.from("client_tokens").insert({
    client_id: clientId,
    token_hash: tokenHash,
  });

  if (insertError) {
    return errorResponse("Error al guardar el nuevo token", 500);
  }

  const response: RotateResponse = {
    token: plaintextToken,
    clientId,
  };

  return jsonResponse(response, 200);
});
