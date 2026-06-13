import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSocketToken } from "@/lib/socket-token";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ token: createSocketToken(session.user.id) });
}
