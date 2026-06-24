import { validateUsername } from "@doomscrollr/shared/lib/username.ts";
import {
  SetUsernameSchema,
  UpdateAccountPreferencesSchema,
} from "@doomscrollr/shared/schemas/user.schema.ts";
import { Hono } from "hono";
import { badRequest, conflict, unauthorized } from "../lib/errors.ts";
import { fetchClerkUser } from "../lib/clerk.ts";
import { parseOrThrow, readJsonBody } from "../lib/validation.ts";
import { verifyClerkToken } from "../middleware/auth.ts";
import {
  createLocalUser,
  getLocalUserByClerkId,
  getUserProfile,
  isUsernameTaken,
  type LocalUser,
  setUsername,
  updateUserPreferences,
} from "../repositories/users.repository.ts";

export const accountRoutes = new Hono();

// Display preferences live only on the authenticated account payload, never on the
// public profile (spec §6 keeps the public boundary minimal).
function accountPreferences(user: LocalUser) {
  return { locale: user.locale, themePreference: user.themePreference };
}

// GET /api/account/me — current account state, used to drive the username setup flow.
accountRoutes.get("/me", async (c) => {
  const clerkUserId = await verifyClerkToken(c);
  if (!clerkUserId) throw unauthorized();

  const existing = await getLocalUserByClerkId(clerkUserId);
  if (existing) {
    return c.json({
      needsUsername: false,
      user: await getUserProfile(existing.username),
      preferences: accountPreferences(existing),
    });
  }

  // Lazy sync (spec §17): if Clerk already exposes a valid, available username, claim it.
  const clerk = await fetchClerkUser(clerkUserId);
  const candidate = clerk.username?.toLowerCase();
  if (candidate && validateUsername(candidate).ok && !(await isUsernameTaken(candidate))) {
    const created = await createLocalUser({
      clerkUserId,
      username: candidate,
      displayName: clerk.displayName,
      avatarUrl: clerk.avatarUrl,
    });
    return c.json({
      needsUsername: false,
      user: await getUserProfile(created.username),
      preferences: accountPreferences(created),
    });
  }

  return c.json({ needsUsername: true, user: null, preferences: null });
});

// POST /api/account/preferences — save theme/language so they follow the account
// across devices. Only provided keys change.
accountRoutes.post("/preferences", async (c) => {
  const clerkUserId = await verifyClerkToken(c);
  if (!clerkUserId) throw unauthorized();

  const existing = await getLocalUserByClerkId(clerkUserId);
  if (!existing) throw badRequest("Choose a username before saving preferences.");

  const patch = parseOrThrow(UpdateAccountPreferencesSchema, await readJsonBody(c));
  const updated = await updateUserPreferences(existing.id, patch);
  return c.json({ preferences: accountPreferences(updated) });
});

// POST /api/account/username — claim or change the local handle (spec §6.3, §17).
accountRoutes.post("/username", async (c) => {
  const clerkUserId = await verifyClerkToken(c);
  if (!clerkUserId) throw unauthorized();

  const { username } = parseOrThrow(SetUsernameSchema, await readJsonBody(c));
  const validation = validateUsername(username);
  if (!validation.ok) {
    throw badRequest(
      validation.reason === "reserved"
        ? "That username is reserved."
        : "Use 3-24 lowercase letters, numbers, or underscores.",
    );
  }
  if (await isUsernameTaken(username)) {
    throw conflict("USERNAME_TAKEN", "That username is already taken.");
  }

  const existing = await getLocalUserByClerkId(clerkUserId);
  if (existing) {
    const updated = await setUsername(existing.id, username);
    return c.json({
      needsUsername: false,
      user: await getUserProfile(updated.username),
      preferences: accountPreferences(updated),
    });
  }

  const clerk = await fetchClerkUser(clerkUserId);
  const created = await createLocalUser({
    clerkUserId,
    username,
    displayName: clerk.displayName,
    avatarUrl: clerk.avatarUrl,
  });
  return c.json({
    needsUsername: false,
    user: await getUserProfile(created.username),
    preferences: accountPreferences(created),
  }, 201);
});
