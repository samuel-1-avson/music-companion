/**
 * Input Validation Middleware
 * 
 * Uses Zod schemas to validate and sanitize request data.
 * Prevents injection attacks and ensures data integrity.
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

/**
 * Create validation middleware for request body
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * Create validation middleware for query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * Create validation middleware for route parameters
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid route parameters',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

// ========== Common Validation Schemas ==========

/** Sanitized string - trims and limits length */
export const sanitizedString = (maxLength: number = 1000) =>
  z.string().trim().max(maxLength);

/** Email validation */
export const emailSchema = z.string().email().max(255).toLowerCase().trim();

/** URL validation */
export const urlSchema = z.string().url().max(2048);

/** Spotify ID validation (alphanumeric, 22 chars) */
export const spotifyIdSchema = z.string().regex(/^[a-zA-Z0-9]{22}$/, 'Invalid Spotify ID');

/** YouTube ID validation (11 chars) */
export const youtubeIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{11}$/, 'Invalid YouTube ID');

/** UUID validation */
export const uuidSchema = z.string().uuid();

/** Positive integer with max */
export const positiveInt = (max: number = 1000) =>
  z.coerce.number().int().positive().max(max);

/** Pagination parameters */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ========== API-Specific Schemas ==========

/** Auth: Login request */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
});

/** Auth: Register request */
export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  name: sanitizedString(100).optional(),
});

/** Music: Search request */
export const searchMusicSchema = z.object({
  query: sanitizedString(200),
  provider: z.enum(['spotify', 'youtube', 'applemusic']).optional(),
  limit: positiveInt(50).optional(),
});

/** AI: Chat request */
export const aiChatSchema = z.object({
  message: sanitizedString(4000),
  conversationId: uuidSchema.optional(),
  context: z.object({
    currentSong: z.string().optional(),
    mood: z.string().optional(),
  }).optional(),
});

/** Playlist: Create request */
export const createPlaylistSchema = z.object({
  name: sanitizedString(100),
  description: sanitizedString(500).optional(),
  isPublic: z.boolean().default(false),
  tracks: z.array(spotifyIdSchema).max(200).optional(),
});

/** Download: Request */
export const downloadRequestSchema = z.object({
  url: urlSchema,
  provider: z.enum(['youtube', 'spotify']),
  quality: z.enum(['low', 'medium', 'high']).default('high'),
});

/** Webhook: Create request */
export const createWebhookSchema = z.object({
  name: sanitizedString(100),
  url: urlSchema,
  events: z.array(z.enum([
    'track.play',
    'track.pause',
    'track.complete',
    'playlist.create',
    'playlist.update',
  ])).min(1).max(10),
  secret: z.string().min(16).max(64).optional(),
});

/** Profile: Update request */
export const updateProfileSchema = z.object({
  displayName: sanitizedString(100).optional(),
  bio: sanitizedString(500).optional(),
  avatarUrl: urlSchema.optional(),
  preferences: z.object({
    theme: z.string().optional(),
    language: z.string().max(10).optional(),
    notifications: z.boolean().optional(),
  }).optional(),
});

// Export all schemas
export const schemas = {
  login: loginSchema,
  register: registerSchema,
  searchMusic: searchMusicSchema,
  aiChat: aiChatSchema,
  createPlaylist: createPlaylistSchema,
  downloadRequest: downloadRequestSchema,
  createWebhook: createWebhookSchema,
  updateProfile: updateProfileSchema,
  pagination: paginationSchema,
};
