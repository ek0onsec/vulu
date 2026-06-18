import { z } from "zod";

const schema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  TMDB_API_KEY: z.string().min(1),
  TMDB_BASE_URL: z.url(),
  TMDB_IMAGE_BASE: z.url(),
  GOOGLE_BOOKS_BASE_URL: z.url().default("https://www.googleapis.com/books/v1"),
  GOOGLE_BOOKS_API_KEY: z.string().optional(),
  UPLOADS_DIR: z.string().default(`${process.cwd()}/uploads`),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function getEnv(): Env {
  if (cached) return cached;
  cached = schema.parse(process.env);
  return cached;
}
