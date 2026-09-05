import { z } from 'zod'

export const envRefSchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]{1,127}$/, 'Secret references must be environment variable names')
  .optional()

const suspiciousPatterns = [
  /(authorization\s*:\s*(?:bearer|token)\s+)[^\s]+/gi,
  /((?:password|passwd|pwd|token|secret|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi,
  /(https?:\/\/[^\s:/]+:)[^@\s]+(@)/gi,
  /(gh[pousr]_[A-Za-z0-9_]{20,})/g,
  /(github_pat_[A-Za-z0-9_]{20,})/g,
]

export function redactSecrets(input: string, secretValues: string[] = []): string {
  let output = input
  for (const secret of secretValues.filter((value) => value.length >= 4)) {
    output = output.split(secret).join('[REDACTED]')
  }
  output = output.replace(suspiciousPatterns[0], '$1[REDACTED]')
  output = output.replace(suspiciousPatterns[1], '$1[REDACTED]')
  output = output.replace(suspiciousPatterns[2], '$1[REDACTED]$2')
  output = output.replace(suspiciousPatterns[3], '[REDACTED]')
  output = output.replace(suspiciousPatterns[4], '[REDACTED]')
  return output
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

