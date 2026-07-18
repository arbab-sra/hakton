import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

export function isGitHubConfigured(environment = process.env) {
  return Boolean(environment.AUTH_GITHUB_ID && environment.AUTH_GITHUB_SECRET);
}

/**
 * Auth.js uses signed JWT sessions while the product's account model is still being built.
 * The Drizzle auth tables are ready for an adapter when persistent sessions are introduced.
 */
export const authConfig = {
  providers: isGitHubConfigured()
    ? [
        GitHub({
          clientId: process.env.AUTH_GITHUB_ID,
          clientSecret: process.env.AUTH_GITHUB_SECRET
        })
      ]
    : [],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/sign-in" }
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
