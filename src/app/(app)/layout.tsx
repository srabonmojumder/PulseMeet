import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RealtimeProvider } from "@/components/realtime-provider";
import { TopBar } from "@/components/top-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <RealtimeProvider>
      <div className="flex h-screen flex-col">
        <TopBar
          name={session.user.name ?? "User"}
          email={session.user.email ?? ""}
          image={session.user.image ?? null}
        />
        <div className="flex min-h-0 flex-1 gap-0 p-0 sm:gap-3 sm:p-3">{children}</div>
      </div>
    </RealtimeProvider>
  );
}
