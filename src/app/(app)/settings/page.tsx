import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, bio: true },
  });
  if (!user) redirect("/login");

  return (
    <main className="glass mx-auto my-0 flex min-h-0 w-full flex-1 flex-col overflow-y-auto sm:rounded-2xl">
      <div className="mx-auto w-full max-w-lg px-5 py-6">
        <ProfileForm
          initial={{
            name: user.name,
            email: user.email,
            image: user.image,
            bio: user.bio ?? "",
          }}
        />
      </div>
    </main>
  );
}
