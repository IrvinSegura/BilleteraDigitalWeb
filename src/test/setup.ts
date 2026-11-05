import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Components read their text from it; tests see the default language, Spanish
import '@/i18n'

// Without Vitest globals, Testing Library can't register its own cleanup. Tests that run in Node (no DOM) have
// no storage to clear.
afterEach(() => {
  cleanup()
  if (typeof window !== 'undefined') {
    localStorage.clear()
    sessionStorage.clear()
  }
})
