import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";

const COOKIE_NAME = "carpool_session";
const SESSION_DAYS = 30;

const MIN_SECRET_LENGTH = 32;
/** Shipped in .env.example, so it must never sign real sessions. */
const EXAMPLE_SECRET = "dev-only-insecure-secret-change-me";

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  if (process.env.NODE_ENV === "production") {
    if (secret.startsWith(EXAMPLE_SECRET)) {
      throw new Error("SESSION_SECRET is still the example value");
    }
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new Error(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
    }
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

async function sessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const userId = await sessionUserId();
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    include: { family: { include: { children: true } } },
  });
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Requires a signed-in, verified user with a family profile. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.emailVerifiedAt || !user.phoneVerifiedAt) redirect("/verify");
  if (!user.family) redirect("/onboarding");
  return user;
}

export async function requireVerifiedUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.emailVerifiedAt || !user.phoneVerifiedAt) redirect("/verify");
  return user;
}
