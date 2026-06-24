import { z } from "zod";
import { USERNAME_REGEX } from "../constants.ts";

export const UserRoleSchema = z.enum(["user", "admin"]);
export const UserStatusSchema = z.enum(["active", "limited", "suspended", "banned"]);
export const UserTrustLevelSchema = z.enum([
  "new",
  "normal",
  "trusted",
  "limited",
  "moderator",
  "admin",
]);

export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_REGEX, "Use 3-24 lowercase letters, numbers, or underscores.");

// Public author. Internal database ids never cross the public boundary (spec §6);
// the username is the public identity.
export const AuthorSchema = z
  .object({
    username: z.string().min(3).max(24),
    displayName: z.string().max(80).nullable(),
    avatarUrl: z.string().url().nullable(),
  })
  .strict();

export const UserProfileSchema = AuthorSchema.extend({
  role: UserRoleSchema,
  status: UserStatusSchema,
  postCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
}).strict();

// Username setup flow for users without a valid local handle (spec §17, ROADMAP V1-033).
export const SetUsernameSchema = z.object({
  username: UsernameSchema,
});

// Per-account display preferences. Kept private to the authenticated account
// payload (never on the public profile). NULL = follow the device/browser.
export const LocaleSchema = z.enum(["en", "pt-BR"]);
export const ThemePreferenceSchema = z.enum(["auto", "light", "dark"]);

export const AccountPreferencesSchema = z
  .object({
    locale: LocaleSchema.nullable(),
    themePreference: ThemePreferenceSchema.nullable(),
  })
  .strict();

// Update payload: only provided keys change; an explicit null clears a preference.
export const UpdateAccountPreferencesSchema = z
  .object({
    locale: LocaleSchema.nullable().optional(),
    themePreference: ThemePreferenceSchema.nullable().optional(),
  })
  .strict();
