import { randomInt } from "node:crypto";
import { z } from "zod";
import { SKILLS } from "./types";

// No 0/O or 1/I/L, so codes survive being read aloud or copied off a screen.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A new invite code such as MAPLE-7K3Q. */
export function inviteCode(slug: string): string {
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${slug.toUpperCase()}-${suffix}`;
}

/** "Team Maple 2!" → "team-maple-2". Empty when the name has no letters or digits. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const MAX_INVITE_USES = 20;

export const joinTeamSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter your invite code.")
    .transform((code) => code.toUpperCase()),
  skills: z.array(z.enum(SKILLS)).default([]).transform((skills) => [...new Set(skills)]),
});
export type JoinTeamInput = z.infer<typeof joinTeamSchema>;

export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a team name.")
    .max(60, "Keep the name under 60 characters.")
    .refine((name) => slugify(name) !== "", "Use at least one letter or digit."),
  tableLocation: z
    .string()
    .trim()
    .max(40, "Keep the table under 40 characters.")
    .optional()
    .transform((value) => value || null),
  isDemo: z.boolean().default(false),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const issueInviteSchema = z.object({
  maxUses: z.int().min(1).max(MAX_INVITE_USES).default(4),
});
export type IssueInviteInput = z.infer<typeof issueInviteSchema>;

/** Database ids are bigints, carried as digit strings. */
export const idSchema = z.string().regex(/^[1-9]\d{0,17}$/, "Must be an id.");

export const moveMemberSchema = z.object({
  teamId: z.union([idSchema, z.int().positive().transform(String)]),
  reason: z.string().trim().min(1, "Give a reason for the move."),
});
export type MoveMemberInput = z.infer<typeof moveMemberSchema>;
