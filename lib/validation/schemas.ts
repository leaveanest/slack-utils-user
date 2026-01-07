/**
 * Validation schemas for slack-utils-user
 *
 * Zod-based type-safe validation with i18n-supported error messages.
 */
import { z } from "zod";
import { initI18n, t } from "../i18n/mod.ts";

// Initialize i18n at top level
await initI18n();

/**
 * Create i18n-aware Slack channel ID schema
 * Format: C + uppercase alphanumeric characters
 *
 * Error messages are evaluated dynamically at validation time,
 * supporting locale changes.
 *
 * @returns Zod schema
 *
 * @example
 * ```typescript
 * const schema = createChannelIdSchema();
 * const channelId = schema.parse("C12345678");
 * ```
 */
export function createChannelIdSchema() {
  return z.string().superRefine((val, ctx) => {
    if (val.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: 1,
        type: "string",
        inclusive: true,
        message: t("errors.validation.channel_id_empty"),
      });
      return;
    }
    if (!/^C[A-Z0-9]+$/.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.invalid_string,
        validation: "regex",
        message: t("errors.validation.channel_id_format"),
      });
    }
  });
}

/**
 * Create i18n-aware Slack user ID schema
 * Format: U or W + uppercase alphanumeric characters
 *
 * Error messages are evaluated dynamically at validation time,
 * supporting locale changes.
 *
 * @returns Zod schema
 *
 * @example
 * ```typescript
 * const schema = createUserIdSchema();
 * const userId = schema.parse("U0812GLUZD2");
 * ```
 */
export function createUserIdSchema() {
  return z.string().superRefine((val, ctx) => {
    if (val.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: 1,
        type: "string",
        inclusive: true,
        message: t("errors.validation.user_id_empty"),
      });
      return;
    }
    if (!/^[UW][A-Z0-9]+$/.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.invalid_string,
        validation: "regex",
        message: t("errors.validation.user_id_format"),
      });
    }
  });
}

/**
 * Create i18n-aware non-empty string schema
 *
 * Error messages are evaluated dynamically at validation time,
 * supporting locale changes.
 *
 * @returns Zod schema
 *
 * @example
 * ```typescript
 * const schema = createNonEmptyStringSchema();
 * const text = schema.parse("Hello");
 * ```
 */
export function createNonEmptyStringSchema() {
  return z.string().superRefine((val, ctx) => {
    if (val.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: 1,
        type: "string",
        inclusive: true,
        message: t("errors.validation.value_empty"),
      });
    }
  });
}

/**
 * Create i18n-aware display name schema
 * Max 80 characters
 *
 * @returns Zod schema
 */
export function createDisplayNameSchema() {
  return z.string().superRefine((val, ctx) => {
    if (val.length > 80) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 80,
        type: "string",
        inclusive: true,
        message: t("errors.validation.display_name_too_long"),
      });
    }
  }).optional();
}

/**
 * Create i18n-aware title schema
 * Max 100 characters
 *
 * @returns Zod schema
 */
export function createTitleSchema() {
  return z.string().superRefine((val, ctx) => {
    if (val.length > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 100,
        type: "string",
        inclusive: true,
        message: t("errors.validation.title_too_long"),
      });
    }
  }).optional();
}

/**
 * Create i18n-aware phone schema
 * Accepts digits, dashes, plus, spaces, and parentheses
 *
 * @returns Zod schema
 */
export function createPhoneSchema() {
  return z.string().superRefine((val, ctx) => {
    if (val.length > 0 && !/^[\d\-+\s()]*$/.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.invalid_string,
        validation: "regex",
        message: t("errors.validation.phone_invalid"),
      });
    }
  }).optional();
}

/**
 * Slack channel ID schema (default instance)
 *
 * Error messages are evaluated dynamically at validation time,
 * automatically supporting locale changes.
 *
 * @example
 * ```typescript
 * const channelId = channelIdSchema.parse("C12345678");
 * ```
 */
export const channelIdSchema = createChannelIdSchema();

/**
 * Slack user ID schema (default instance)
 *
 * Error messages are evaluated dynamically at validation time,
 * automatically supporting locale changes.
 *
 * @example
 * ```typescript
 * const userId = userIdSchema.parse("U0812GLUZD2");
 * ```
 */
export const userIdSchema = createUserIdSchema();

/**
 * Non-empty string schema (default instance)
 *
 * Error messages are evaluated dynamically at validation time,
 * automatically supporting locale changes.
 *
 * @example
 * ```typescript
 * const text = nonEmptyStringSchema.parse("Hello");
 * ```
 */
export const nonEmptyStringSchema = createNonEmptyStringSchema();

/**
 * Display name schema (default instance)
 */
export const displayNameSchema = createDisplayNameSchema();

/**
 * Title schema (default instance)
 */
export const titleSchema = createTitleSchema();

/**
 * Phone schema (default instance)
 */
export const phoneSchema = createPhoneSchema();

/**
 * Profile update input validation schema
 */
export const profileUpdateInputSchema = z.object({
  target_user_id: userIdSchema,
  display_name: displayNameSchema,
  title: titleSchema,
  phone: phoneSchema,
  pronouns: z.string().max(50).optional(),
});

/**
 * Type inference exports
 */
export type ChannelId = z.infer<ReturnType<typeof createChannelIdSchema>>;
export type UserId = z.infer<ReturnType<typeof createUserIdSchema>>;
export type NonEmptyString = z.infer<
  ReturnType<typeof createNonEmptyStringSchema>
>;
export type DisplayName = z.infer<ReturnType<typeof createDisplayNameSchema>>;
export type Title = z.infer<ReturnType<typeof createTitleSchema>>;
export type Phone = z.infer<ReturnType<typeof createPhoneSchema>>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateInputSchema>;
