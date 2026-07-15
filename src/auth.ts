import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

const isDevBypass =
  process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "true";

function getProviders() {
  const providers: NextAuthConfig["providers"] = [];

  if (
    process.env.AUTHENTIK_ISSUER &&
    process.env.AUTHENTIK_CLIENT_ID &&
    process.env.AUTHENTIK_CLIENT_SECRET
  ) {
    providers.push({
      id: "authentik",
      name: "Authentik",
      type: "oidc",
      issuer: process.env.AUTHENTIK_ISSUER,
      clientId: process.env.AUTHENTIK_CLIENT_ID,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET,
    });
  }

  if (isDevBypass) {
    providers.push(
      Credentials({
        id: "dev-bypass",
        name: "Dev Login",
        credentials: {
          email: { label: "Email", type: "email" },
          name: { label: "Name", type: "text" },
        },
        async authorize(credentials) {
          if (!credentials?.email) return null;
          return {
            id: String(credentials.email),
            email: String(credentials.email),
            name: String(credentials.name || credentials.email),
          };
        },
      }),
    );
  }

  return providers;
}

export const authConfig: NextAuthConfig = {
  providers: getProviders(),
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = account?.providerAccountId ?? user.id ?? user.email ?? token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
