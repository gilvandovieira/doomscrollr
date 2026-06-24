import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { type Account, fetchAccount } from "./api.ts";
import { type GetAuthToken, HAS_CLERK, HAS_TEST_AUTH, readTestAuthClerkId } from "./auth.ts";

const NO_TOKEN: GetAuthToken = () => Promise.resolve(null);

// Returns a function that resolves the current Clerk session token (or null).
// HAS_CLERK is a build-time constant, so the branch is stable across renders.
export function useAuthToken(): GetAuthToken {
  if (HAS_TEST_AUTH) {
    return () => {
      const clerkId = readTestAuthClerkId();
      return Promise.resolve(clerkId ? `test:${clerkId}` : null);
    };
  }
  if (!HAS_CLERK) return NO_TOKEN;
  const { getToken } = useAuth();
  return () => getToken();
}

export function useIsSignedIn(): boolean {
  if (HAS_TEST_AUTH) return Boolean(readTestAuthClerkId());
  if (!HAS_CLERK) return false;
  return useAuth().isSignedIn ?? false;
}

// Local account state, used to drive the username setup flow (spec §17).
export function useAccount() {
  const getToken = useAuthToken();
  const isSignedIn = useIsSignedIn();
  return useQuery<Account>({
    queryKey: ["account"],
    enabled: isSignedIn,
    queryFn: () => fetchAccount(getToken),
    staleTime: 60_000,
  });
}

// Gates admin-only entry points (e.g. the moderation console link). Sourced from
// the server-verified role in /api/account/me, never just "is signed in" — and
// the /api/admin routes enforce the role again server-side regardless.
export function useIsAdmin(): boolean {
  return useAccount().data?.user?.role === "admin";
}
