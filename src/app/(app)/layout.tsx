import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { RealtimeProvider } from "@/components/realtime-provider";
import { TopBar } from "@/components/top-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // A JWT can outlive the User row it points at (e.g. the dev DB was reseeded
  // while the browser kept its session cookie). Such a session passes the token
  // check above but every DB write keyed on userId then fails a foreign-key
  // constraint, so treat a missing row as logged-out and force re-auth.
  const exists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!exists) redirect("/login");

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
