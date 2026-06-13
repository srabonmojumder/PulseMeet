import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        // Normalize: mobile keyboards often auto-capitalize the first letter,
        // and emails are stored lowercased at registration.
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    // Auth.js v5 doesn't reliably derive the origin behind a custom server and
    // falls back to localhost, which breaks logins from other devices (a
    // phone's "localhost" is the phone). Rebuild the redirect target from the
    // ACTUAL request host so it always stays on the origin the client used.
    async redirect({ url, baseUrl }) {
      let realBase = baseUrl;
      try {
        const h = await headers();
        const host = h.get("x-forwarded-host") ?? h.get("host");
        const proto = h.get("x-forwarded-proto") ?? "http";
        if (host) realBase = `${proto}://${host}`;
      } catch {
        // headers() unavailable outside a request scope — fall back to baseUrl.
      }
      try {
        const target = new URL(url, realBase);
        // Only allow same-origin redirects; otherwise send home.
        if (target.origin === realBase) return target.toString();
      } catch {
        // ignore malformed url
      }
      return realBase;
    },
    jwt({ token, user, trigger, session }) {
      if (user) token.id = user.id as string;
      // Reflect profile edits into the session without re-login.
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.image !== undefined) token.picture = session.image;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
