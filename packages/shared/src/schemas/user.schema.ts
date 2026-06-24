import { z } from "zod";

export const UserRoleSchema = z.enum(["user", "moderator", "admin"]);
export const UserStatusSchema = z.enum(["active", "restricted", "banned"]);

export const AuthorSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(3).max(32),
  displayName: z.string().min(1).max(80),
  avatarUrl: z.string().url(),
});

export const UserProfileSchema = AuthorSchema.extend({
  role: UserRoleSchema.default("user"),
  status: UserStatusSchema.default("active"),
  bio: z.string().max(240).default(""),
  postCount: z.number().int().nonnegative().default(0),
  commentCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
});
