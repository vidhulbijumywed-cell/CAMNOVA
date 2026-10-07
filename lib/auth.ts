import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { createHash } from "node:crypto";
import { db } from "./db";
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "CAMNOVA",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase();
        if (
          !email ||
          !credentials?.password ||
          email.length > 254 ||
          credentials.password.length > 256
        )
          return null;
        const key = createHash("sha256").update(email).digest("hex");
        const attempt = await db.loginAttempt.findUnique({
          where: { id: key },
        });
        if (attempt && attempt.resetAt > new Date() && attempt.count >= 8)
          return null;
        await db.loginAttempt.upsert({
          where: { id: key },
          create: {
            id: key,
            count: 1,
            resetAt: new Date(Date.now() + 15 * 60000),
          },
          update:
            attempt && attempt.resetAt > new Date()
              ? { count: { increment: 1 } }
              : { count: 1, resetAt: new Date(Date.now() + 15 * 60000) },
        });
        const user = await db.user.findUnique({ where: { email } });
        // Perform a comparison on a fixed hash even when no user exists.
        const valid = await compare(
          credentials.password,
          user?.passwordHash ??
            "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5C7Ry3EEVGukTZpjV9/2XT2fVCZqYaW",
        );
        if (!user?.active || !valid) return null;
        await db.loginAttempt.deleteMany({ where: { id: key } });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
    CredentialsProvider({
      id: "customer",
      name: "Customer account",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        if (
          !email ||
          !credentials?.password ||
          email.length > 254 ||
          credentials.password.length > 256
        )
          return null;
        const key = createHash("sha256")
          .update("customer:" + email)
          .digest("hex");
        const attempt = await db.loginAttempt.findUnique({
          where: { id: key },
        });
        if (attempt && attempt.resetAt > new Date() && attempt.count >= 8)
          return null;
        await db.loginAttempt.upsert({
          where: { id: key },
          create: {
            id: key,
            count: 1,
            resetAt: new Date(Date.now() + 15 * 60000),
          },
          update:
            attempt && attempt.resetAt > new Date()
              ? { count: { increment: 1 } }
              : { count: 1, resetAt: new Date(Date.now() + 15 * 60000) },
        });
        const user = await db.customerAccount.findUnique({ where: { email } });
        // Perform a comparison on a fixed hash even when no user exists.
        const valid = await compare(
          credentials.password,
          user?.passwordHash ??
            "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5C7Ry3EEVGukTZpjV9/2XT2fVCZqYaW",
        );
        if (!user?.active || !valid) return null;
        await db.loginAttempt.deleteMany({ where: { id: key } });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          sessionVersion: user.sessionVersion,
          accountType: "customer",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.accountType =
          (user as typeof user & { accountType?: string }).accountType ??
          "workspace";
        token.sessionVersion = (
          user as typeof user & { sessionVersion: number }
        ).sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user)
        Object.assign(session.user, {
          id: token.sub!,
          sessionVersion: token.sessionVersion,
          accountType: token.accountType,
        });
      return session;
    },
  },
};
export type Actor = { id: string; role: string; name: string; email: string };
export async function actor(): Promise<Actor> {
  const session = await getServerSession(authOptions);
  if (
    (session?.user as { accountType?: string } | undefined)?.accountType ===
    "customer"
  )
    throw new HttpError(403, "Staff access required");
  const id = (session?.user as { id?: string } | undefined)?.id;
  const user = id ? await db.user.findUnique({ where: { id } }) : null;
  if (
    !user?.active ||
    user.sessionVersion !==
      (session?.user as { sessionVersion?: number } | undefined)?.sessionVersion
  )
    throw new HttpError(401, "Please sign in");
  return { id: user.id, role: user.role, name: user.name, email: user.email };
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function admin(a: Actor) {
  if (a.role !== "ADMIN") throw new HttpError(403, "Owner permission required");
}

export async function customerActor() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    { id?: string; accountType?: string; sessionVersion?: number } | undefined;
  if (user?.accountType !== "customer" || !user.id)
    throw new HttpError(401, "Sign in to your customer account");
  const account = await db.customerAccount.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      sessionVersion: true,
      customerId: true,
    },
  });
  if (!account?.active || account.sessionVersion !== user.sessionVersion)
    throw new HttpError(401, "Please sign in again");
  return account;
}
