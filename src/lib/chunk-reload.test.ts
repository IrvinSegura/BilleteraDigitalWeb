import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isChunkLoadError, reloadForNewRelease } from './chunk-reload'

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://app.example.com/assets/WalletsPage-abc.js',
    'error loading dynamically imported module: https://app.example.com/assets/WalletsPage-abc.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/WalletsPage-abc.css',
  ])('recognises %j', (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true)
  })

  it('ignores any other error', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(false)
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false)
  })
})

describe('reloadForNewRelease', () => {
  const reload = vi.fn()

  beforeEach(() => {
    reload.mockReset()
    vi.stubGlobal('location', { ...window.location, reload })
  })

  it('reloads the page the first time', () => {
    expect(reloadForNewRelease(1_000_000)).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
  })

  it("doesn't reload again right after a reload, so a broken deploy can't loop", () => {
    reloadForNewRelease(1_000_000)
    expect(reloadForNewRelease(1_005_000)).toBe(false)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads again for a later release', () => {
    reloadForNewRelease(1_000_000)
    expect(reloadForNewRelease(1_060_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})
