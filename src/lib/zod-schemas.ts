import { z } from "zod";

export const tastesSchema = z.object({
  filmGenreIds: z.array(z.number().int()).min(3),
  bookGenreIds: z.array(z.number().int()).default([]),
  people: z.array(z.object({ tmdbId: z.number().int(), name: z.string(), role: z.enum(["actor", "director", "author"]) })),
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
export const workRefSchema = z.object({ source: z.enum(["tmdb", "googlebooks"]), externalId: z.string(), type: z.enum(["movie", "tv", "book"]) });
export const setStatusSchema = z.object({ ref: workRefSchema, status: z.enum(["planned", "in_progress", "done"]) });
export const rateSchema = z.object({
  ref: workRefSchema,
  rating: z.number().min(0).max(5).nullable(),
  text: z.string().max(2000).nullable(),
  audiences: z.object({
    public: z.boolean(),
    circle: z.boolean(),
    communityIds: z.array(z.string()),
  }),
});
const progInt = z.number().int().min(1).nullable().optional();
export const progressSchema = z.object({
  ref: workRefSchema,
  season: progInt, episode: progInt, tome: progInt, page: progInt,
});
export const createListSchema = z.object({
  name: z.string().min(1).max(60),
  kind: z.enum(["films", "books", "mixed"]),
  description: z.string().max(300).nullable(), visibility: z.enum(["public", "private"]),
});
export const commentSchema = z.object({ text: z.string().min(1).max(1000) });
export const userSearchSchema = z.object({ q: z.string().min(1).max(50) });
export const checkAccountSchema = z.object({
  u: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/i),
  e: z.email(),
});
export const changeUsernameSchema = z.object({ username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/i), currentPassword: z.string().min(1) });
export const changeEmailSchema = z.object({ email: z.email(), currentPassword: z.string().min(1) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
export const createCommunitySchema = z.object({ name: z.string().min(2).max(50), description: z.string().max(300).nullable(), visibility: z.enum(["public", "private"]).default("public") });
export const showcaseSchema = z.object({
  movie: z.array(z.string()).max(5),
  tv: z.array(z.string()).max(5),
  book: z.array(z.string()).max(5),
});

export const isbnSchema = z.object({ isbn: z.string().min(10).max(20) });

// 2FA — le code accepte TOTP à 6 chiffres ou code de secours (ex. ABCD-EFGH), espaces/tirets tolérés.
export const totpCodeSchema = z.object({ code: z.string().min(6).max(20) });
export const twoFactorLoginSchema = z.object({ challenge: z.string().min(1), code: z.string().min(6).max(20) });
export const disable2faSchema = z.object({ password: z.string().min(1) });
