import { z } from 'zod';
z.config(z.locales.es());
import { BASIC_LETTERS } from '../constants/index.js';
const readable = (v: string) => !/[\p{Cc}\p{Cf}]/u.test(v);
export const nicknameSchema = z
  .string()
  .normalize('NFKC')
  .trim()
  .max(96, 'Usa hasta 24 caracteres visibles.')
  .refine((v) => {
    const length = Array.from(
      new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(v),
    ).length;
    return length >= 2 && length <= 24;
  }, 'Usa entre 2 y 24 caracteres visibles.')
  .refine(readable, 'El nombre contiene caracteres no permitidos.');
export const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{5,6}$/, 'Código de sala inválido.');
export const settingsSchema = z
  .object({
    capacity: z.number().int().min(2).max(7).nullable().default(null),
    rounds: z.union([z.literal(3), z.literal(5), z.literal(7), z.literal(10)]).default(5),
    roundSeconds: z
      .union([z.literal(60), z.literal(90), z.literal(120), z.literal(180)])
      .default(90),
    bastaEnabled: z.boolean().default(true),
    letters: z
      .array(z.string().regex(/^[A-Z]$/))
      .min(1)
      .max(26)
      .refine((v) => new Set(v).size === v.length)
      .default(BASIC_LETTERS),
    disabledCategories: z.array(z.string().max(60)).max(48).default([]),
  })
  .strict();
const mutation = { clientMutationId: z.string().uuid() };
const round = { ...mutation, roundId: z.string().uuid() };
const answer = { ...mutation, answerId: z.string().uuid() };
const reason = z.string().trim().min(3).max(240).refine(readable);
export const commandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('room:create'),
      nickname: nicknameSchema,
      settings: settingsSchema,
      ...mutation,
    })
    .strict(),
  z
    .object({
      type: z.literal('room:join'),
      code: codeSchema,
      nickname: nicknameSchema,
      desiredSlot: z.number().int().min(1).max(7).optional(),
      ...mutation,
    })
    .strict(),
  z.object({ type: z.literal('room:resume'), code: codeSchema }).strict(),
  z.object({ type: z.literal('room:ready'), ready: z.boolean(), ...mutation }).strict(),
  z
    .object({ type: z.literal('room:update-settings'), settings: settingsSchema, ...mutation })
    .strict(),
  z.object({ type: z.literal('room:reroll'), ...mutation }).strict(),
  z
    .object({
      type: z.literal('room:reserve-slot'),
      slot: z.number().int().min(1).max(7),
      nickname: nicknameSchema,
      ...mutation,
    })
    .strict(),
  z
    .object({
      type: z.literal('room:remove-reservation'),
      slot: z.number().int().min(1).max(7),
      ...mutation,
    })
    .strict(),
  z
    .object({
      type: z.literal('room:approve-claim'),
      slot: z.number().int().min(1).max(7),
      approve: z.boolean(),
      ...mutation,
    })
    .strict(),
  z
    .object({ type: z.literal('room:kick'), participantId: z.string().uuid(), ...mutation })
    .strict(),
  z.object({ type: z.literal('room:leave'), ...mutation }).strict(),
  z.object({ type: z.literal('game:start'), ...mutation }).strict(),
  z.object({ type: z.literal('draw:stop'), ...round }).strict(),
  z
    .object({
      type: z.literal('answers:save-draft'),
      ...round,
      categoryId: z.string().max(60),
      text: z.string().max(80).refine(readable),
      previousVersion: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ type: z.literal('answers:submit'), ...round }).strict(),
  z.object({ type: z.literal('round:call-basta'), ...round }).strict(),
  z
    .object({
      type: z.literal('review:vote'),
      ...answer,
      valid: z.boolean(),
      reason: z.string().max(240).refine(readable).default(''),
    })
    .strict(),
  z
    .object({
      type: z.literal('review:appeal'),
      ...answer,
      reason,
      evidence: z
        .url()
        .refine((v) => new URL(v).protocol === 'https:')
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('review:resolve'),
      ...answer,
      valid: z.boolean(),
      reason,
      canonical: z.string().trim().min(1).max(80).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('review:award'),
      ...answer,
      points: z.union([z.literal(0), z.literal(10), z.literal(20)]),
      reason,
    })
    .strict(),
  z
    .object({ type: z.literal('review:annul-propose'), ...round, categoryId: z.string().max(60) })
    .strict(),
  z
    .object({
      type: z.literal('review:annul-vote'),
      ...round,
      categoryId: z.string().max(60),
      approve: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal('review:finish'), ...mutation }).strict(),
  z.object({ type: z.literal('scores:publish'), ...mutation }).strict(),
  z.object({ type: z.literal('game:next-round'), ...mutation }).strict(),
  z.object({ type: z.literal('game:end'), reason, ...mutation }).strict(),
  z.object({ type: z.literal('game:pause'), paused: z.boolean(), ...mutation }).strict(),
  z.object({ type: z.literal('game:rematch'), ...mutation }).strict(),
]);
export type Command = z.infer<typeof commandSchema>;
export const DEFAULT_SETTINGS = settingsSchema.parse({});
