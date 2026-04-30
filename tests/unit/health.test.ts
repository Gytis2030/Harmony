import { describe, it, expect } from 'vitest'

// Verifies the test runner is wired up correctly. Does not hit the database.
describe('health check (unit)', () => {
  it('constructs a health response shape', () => {
    const response = { status: 'ok', timestamp: new Date().toISOString() }
    expect(response).toHaveProperty('status', 'ok')
    expect(response).toHaveProperty('timestamp')
    expect(typeof response.timestamp).toBe('string')
  })
})
