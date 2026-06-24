import { RESERVED_USERNAMES, USERNAME_REGEX } from "../constants.ts";

export function isReservedUsername(username: string): boolean {
  return (RESERVED_USERNAMES as readonly string[]).includes(username.toLowerCase());
}

export type UsernameValidation =
  | { ok: true }
  | { ok: false; reason: "format" | "reserved" };

// Handle rules: 3-24 chars, lowercase letters/numbers/underscore, not reserved (spec §6.3).
export function validateUsername(username: string): UsernameValidation {
  if (!USERNAME_REGEX.test(username)) {
    return { ok: false, reason: "format" };
  }

  if (isReservedUsername(username)) {
    return { ok: false, reason: "reserved" };
  }

  return { ok: true };
}
