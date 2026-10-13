import Link from "next/link";
import { AccountProvider } from "@/components/v2/account";
import { AuthScreen } from "@/components/v2/auth-screen";
export default function ResetPage() {
  return (
    <AccountProvider>
      <main className="standalone-page">
        <Link className="text-link" href="/">
          ← Volver a GAMBLING
        </Link>
        <AuthScreen initial="reset" />
      </main>
    </AccountProvider>
  );
}
