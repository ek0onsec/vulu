import { z } from "zod";

export const tastesSchema = z.object({
  filmGenreIds: z.array(z.number().int()).min(3),
  people: z.array(z.object({ tmdbId: z.number().int(), name: z.string(), role: z.enum(["actor", "director"]) })),
});
export const registerSchema = z.object({
  email: z.email(),
  username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/i),
  displayName: z.string().min(1).max(40),
  password: z.string().min(8),
  activeTabs: z.array(z.enum(["films", "books"])).min(1),
  tastes: tastesSchema,
});
export const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });
export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(40), bio: z.string().max(300).nullable(),
  avatarUrl: z.url().nullable(), activeTabs: z.array(z.enum(["films", "books"])).min(1),
});
export const workRefSchema = z.object({ source: z.literal("tmdb"), externalId: z.string(), type: z.enum(["movie", "tv"]) });
export const setStatusSchema = z.object({ ref: workRefSchema, status: z.enum(["planned", "done"]) });
export const rateSchema = z.object({
  ref: workRefSchema,
  rating: z.number().min(0).max(5).nullable(),
  text: z.string().max(2000).nullable(),
  visibility: z.enum(["circle", "public"]),
});
export const createListSchema = z.object({
  name: z.string().min(1).max(60),
  kind: z.enum(["films", "books", "mixed"]),
  description: z.string().max(300).nullable(), visibility: z.enum(["public", "private"]),
});
export const commentSchema = z.object({ text: z.string().min(1).max(1000) });
export const changeUsernameSchema = z.object({ username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/i) });
export const changeEmailSchema = z.object({ email: z.email(), currentPassword: z.string().min(1) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
