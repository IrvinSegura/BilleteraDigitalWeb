import { describe, expect, it } from 'vitest'

import { describeUserAgent } from './user-agent'

describe('describeUserAgent', () => {
  it.each([
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      { browser: 'Chrome', os: 'Windows', mobile: false }],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
      { browser: 'Edge', os: 'Windows', mobile: false }],
    ['Mozilla/5.0 (Windows NT 10.0; rv:140.0) Gecko/20100101 Firefox/140.0',
      { browser: 'Firefox', os: 'Windows', mobile: false }],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      { browser: 'Safari', os: 'macOS', mobile: false }],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      { browser: 'Safari', os: 'iOS', mobile: true }],
    ['Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
      { browser: 'Samsung Internet', os: 'Android', mobile: true }],
  ])('names %s', (ua, expected) => {
    expect(describeUserAgent(ua)).toEqual(expected)
  })

  it('tells apart an API client from an unknown device', () => {
    expect(describeUserAgent('curl/8.9.1')).toEqual({ browser: 'Otra aplicación', os: '', mobile: false })
    expect(describeUserAgent(undefined)).toEqual({ browser: 'Dispositivo desconocido', os: '', mobile: false })
  })
})
