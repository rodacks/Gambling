import { AccountProvider } from "@/components/v2/account";
import { PublicProfile } from "@/components/v2/public-player";
export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AccountProvider>
      <PublicProfile id={id} />
    </AccountProvider>
  );
}
