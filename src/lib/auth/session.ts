// MVP: Simple cookie-based session. Replace with NextAuth/Clerk later.

import { cookies } from "next/headers";

const SESSION_COOKIE = "wsm_session";

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session) return null;

  // MVP: session value is just the user ID
  return { userId: session.value };
}

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}
