import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "./AuthProvider";

export function AdminLoginPage() {
  const { signIn, error: authError, status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await signIn(email.trim(), password);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo iniciar sesión.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <section aria-labelledby="admin-login-title">
        <h1 id="admin-login-title">Acceso administrativo</h1>
        <p>Iniciá sesión para administrar Todo Artesanal.</p>

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="admin-email">Correo electrónico</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="admin-password">Contraseña</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {(submitError || authError) && (
            <p role="alert">{submitError ?? authError}</p>
          )}

          <button type="submit" disabled={isSubmitting || status === "loading"}>
            {isSubmitting ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}
