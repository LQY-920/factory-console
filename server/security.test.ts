// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { EnvironmentSecretProvider, redactSecrets } from './security.js'

describe('credential safety', () => {
  it('preserves JSON syntax while removing private download tokens', () => {
    const json = JSON.stringify({ download_url: 'https://example.invalid/file?token=SYNTHETIC_ONLY', content: 'IyBIZWxsbw==', encoding: 'base64', token: 'SYNTHETIC_ONLY' })
    const redacted = redactSecrets(json)
    expect(redacted).not.toContain('SYNTHETIC_ONLY')
    expect(JSON.parse(redacted)).toMatchObject({ content: 'IyBIZWxsbw==', encoding: 'base64', token: '[REDACTED]' })
  })
  afterEach(() => { delete process.env.FACTORY_TEST_SECRET })

  it('redacts resolved values and common credential patterns', () => {
    const output = redactSecrets('token=plain-token authorization: Bearer abc123 ghp_123456789012345678901234', ['plain-token'])
    expect(output).not.toContain('plain-token')
    expect(output).not.toContain('abc123')
    expect(output).not.toContain('ghp_')
    expect(output).toContain('[REDACTED]')
  })

  it('resolves only valid environment references', () => {
    process.env.FACTORY_TEST_SECRET = 'hidden-value'
    const provider = new EnvironmentSecretProvider()
    expect(provider.isConfigured('FACTORY_TEST_SECRET')).toBe(true)
    expect(provider.resolve('FACTORY_TEST_SECRET')).toBe('hidden-value')
    expect(provider.resolve('$(danger)')).toBeUndefined()
  })
})
