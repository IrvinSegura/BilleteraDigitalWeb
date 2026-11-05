import i18n from '@/i18n'

/** A session's device as people name it, read from the browser's User-Agent. */
export interface DeviceDescription {
  browser: string
  os: string
  mobile: boolean
}

// Order matters: Edge, Opera and Samsung also say "Chrome", and Chrome also says "Safari"
const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/CrOS/, 'ChromeOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
]

export function describeUserAgent(userAgent: string | undefined): DeviceDescription {
  const ua = userAgent ?? ''
  const browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1]
  const os = SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1]
  return {
    // API clients and scripts don't look like a browser
    browser: browser ?? i18n.t(ua ? 'settings.sessions.otherApp' : 'settings.sessions.unknownDevice'),
    os: os ?? '',
    mobile: /Mobi|iPhone|iPad|Android/.test(ua),
  }
}
