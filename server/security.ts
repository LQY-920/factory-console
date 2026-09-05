import { z } from 'zod'
import type { ProjectConfig } from '../shared/types.js'

export const envRefSchema = z.preprocess((value) => value === '' ? undefined : value, z
  .string()
  .regex(/^[A-Z][A-Z0-9_]{1,127}$/, 'Secret references must be environment variable names')
  .optional())

export function projectSecretRefs(project: ProjectConfig): Array<string | undefined> {
  return [project.mysql.passwordSecretRef, project.deploy.credentialSecretRef, project.notification.target, project.notification.webhookSecretRef]
}

export function projectSecretValues(project: ProjectConfig, provider: SecretProvider): string[] {
  return projectSecretRefs(project).map((ref) => provider.resolve(ref)).filter((value): value is string => Boolean(value))
}

const suspiciousPatterns = [
  /(authorization\s*:\s*(?:bearer|token)\s+)[^\s]+/gi,
  /((?:password|passwd|pwd|token|secret|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi,
  /(https?:\/\/[^\s:/]+:)[^@\s]+(@)/gi,
  /(gh[pousr]_[A-Za-z0-9_]{20,})/g,
  /(github_pat_[A-Za-z0-9_]{20,})/g,
]

function redactText(input: string, secretValues: string[]): string {
  let output = input
  for (const secret of secretValues.filter(Boolean).sort((a, b) => b.length - a.length)) {
    output = output.split(secret).join('[REDACTED]')
  }
  output = output.replace(suspiciousPatterns[0], '$1[REDACTED]')
  output = output.replace(suspiciousPatterns[1], '$1[REDACTED]')
  output = output.replace(suspiciousPatterns[2], '$1[REDACTED]$2')
  output = output.replace(suspiciousPatterns[3], '[REDACTED]')
  output = output.replace(suspiciousPatterns[4], '[REDACTED]')
  return output
}

export function redactSecrets(input: string, secretValues: string[] = []): string {
  // Redact string values, then serialize: URL tokens must not consume JSON quotes.
  try {
    const value: unknown = JSON.parse(input)
    if (value && typeof value === 'object') return JSON.stringify(value, (key, item: unknown) => {
      if (/^(?:password|passwd|pwd|token|secret|api[_-]?key)$/i.test(key)) return '[REDACTED]'
      return typeof item === 'string' ? redactText(item, secretValues) : item
    })
  } catch { /* Plain-text command output. */ }
  return redactText(input, secretValues)
}

export interface SecretProvider {
  isConfigured(reference?: string): boolean
  resolve(reference?: string): string | undefined
}

export class EnvironmentSecretProvider implements SecretProvider {
  isConfigured(reference?: string): boolean {
    return Boolean(reference && process.env[reference])
  }

  resolve(reference?: string): string | undefined {
    if (!reference || !/^[A-Z][A-Z0-9_]{1,127}$/.test(reference)) return undefined
    return process.env[reference]
  }
}

// Extension point: a future provider can implement Windows Credential Manager or DPAPI.
// The MVP intentionally ships only the environment-variable provider above.
