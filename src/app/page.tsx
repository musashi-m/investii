import { isAuthenticatedServer } from "@/lib/auth/pin";
import PinGate from "@/components/PinGate";
import WalletDashboard from "@/components/WalletDashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const authenticated = await isAuthenticatedServer();
  if (!authenticated) {
    return <PinGate />;
  }
  return <WalletDashboard />;
}
