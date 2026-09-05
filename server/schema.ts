import { z } from 'zod'
import { envRefSchema } from './security.js'
import { isAbsolute, win32 } from 'node:path'

const safeRelativePath = z
  .string()
  .min(1)
  .max(300)
  .refine((value) => !value.startsWith('-'), 'Options are not paths')
  .refine((value) => !value.includes('\0'), 'Path contains a null byte')
  .refine((value) => !/\r|\n/.test(value), 'Path contains a line break')
  .refine((value) => !/^[\\/]/.test(value) && !/^[A-Za-z]:/.test(value), 'Expected a project-relative path')
  .refine((value) => !value.split(/[\\/]/).includes('..'), 'Path traversal is not allowed')

export const projectInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    enabled: z.boolean(),
    localRepoPath: z.string().trim().min(1).max(500).refine((value) => !/[\r\n\0]/.test(value) && (isAbsolute(value) || win32.isAbsolute(value)), 'Expected an absolute repository path'),
    githubRepo: z.string().trim().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).optional().or(z.literal('')),
    factoryScriptPath: safeRelativePath,
    prdPath: safeRelativePath,
    batchName: z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/),
    defaultBranch: z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,119}$/),
    mysql: z.object({
      host: z.string().trim().max(255),
      port: z.number().int().min(1).max(65535),
      database: z.string().trim().max(128),
      username: z.string().trim().max(128),
      passwordSecretRef: envRefSchema,
    }).strict(),
    deploy: z.object({
      host: z.string().trim().max(255),
      port: z.number().int().min(1).max(65535),
      username: z.string().trim().max(128),
      projectPath: z.string().trim().max(500),
      domain: z.string().trim().max(255),
      credentialSecretRef: envRefSchema,
    }).strict(),
    notification: z.object({
      type: z.enum(['none', 'webhook']),
      target: envRefSchema.transform((value) => value ?? ''),
      webhookSecretRef: envRefSchema,
    }).strict(),
    dailyReport: z.object({
      enabled: z.boolean(),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      timezone: z.string().trim().min(1).max(100).refine((value) => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false } }, 'Invalid timezone'),
      locale: z.enum(['zh-CN', 'en-US']).optional(),
    }).strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.notification.type === 'webhook') {
      try {
        if (!value.notification.target) throw new Error('reference')
      } catch {
        context.addIssue({ code: 'custom', path: ['notification', 'target'], message: 'Webhook target must be an environment variable reference' })
      }
    }
  })

export const reportRequestSchema = z.object({
  projectId: z.string().uuid(),
  locale: z.enum(['zh-CN', 'en-US']).default('zh-CN'),
}).strict()
