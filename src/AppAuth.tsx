import { AuthProvider } from "./features/auth/AuthProvider";
import { AppRouter } from "./app/AppRouter";

function AppAuth() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default AppAuth;
