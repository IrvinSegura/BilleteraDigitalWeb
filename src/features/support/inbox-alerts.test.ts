import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type AlertPrefs, useInboxAlerts } from './inbox-alerts'

const quiet: AlertPrefs = { sound: false, desktop: false }
const text = { title: 'Aviso', body: 'Detalle' }

interface Props {
  activeCaseId?: string
  lastCustomerMessageAt?: string
  viewing?: string
}

function watch(initial: Props) {
  const onAlert = vi.fn(() => text)
  const hook = renderHook((props: Props) => useInboxAlerts({
    loaded: true, prefs: quiet, onAlert, activeCaseId: props.activeCaseId,
    lastCustomerMessageAt: props.lastCustomerMessageAt, viewing: props.viewing,
  }), { initialProps: initial })
  return { ...hook, onAlert }
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  setHidden(false)
  document.title = ''
})

describe('useInboxAlerts', () => {
  it('takes the first read as where things stand, not as news', () => {
    const { onAlert } = watch({ activeCaseId: 'c1', lastCustomerMessageAt: 'T1' })

    expect(onAlert).not.toHaveBeenCalled()
  })

  it('tells of a case that comes to the agent', () => {
    const { rerender, onAlert } = watch({})

    rerender({ activeCaseId: 'c2', lastCustomerMessageAt: 'T1' })

    expect(onAlert).toHaveBeenCalledExactlyOnceWith({ kind: 'case', caseId: 'c2' }, false)
  })

  it('tells of a message while the agent looks elsewhere', () => {
    const { rerender, onAlert } = watch({ activeCaseId: 'c1', lastCustomerMessageAt: 'T1' })

    rerender({ activeCaseId: 'c1', lastCustomerMessageAt: 'T2' })

    expect(onAlert).toHaveBeenCalledExactlyOnceWith({ kind: 'message', caseId: 'c1' }, false)
  })

  it('stays quiet about a message in the case on screen', () => {
    const { rerender, onAlert } = watch({ activeCaseId: 'c1', lastCustomerMessageAt: 'T1', viewing: 'c1' })

    rerender({ activeCaseId: 'c1', lastCustomerMessageAt: 'T2', viewing: 'c1' })

    expect(onAlert).not.toHaveBeenCalled()
  })

  it('counts in the tab\'s title what arrived while away, until the agent looks again', () => {
    document.title = 'Bandeja'
    const { rerender, result, onAlert } = watch({ activeCaseId: 'c1', lastCustomerMessageAt: 'T1', viewing: 'c1' })
    setHidden(true)

    rerender({ activeCaseId: 'c1', lastCustomerMessageAt: 'T2', viewing: 'c1' })

    expect(onAlert).toHaveBeenCalledWith({ kind: 'message', caseId: 'c1' }, true)
    expect(result.current).toBe(1)
    expect(document.title).toBe('(1) Bandeja')

    act(() => setHidden(false))

    expect(result.current).toBe(0)
    expect(document.title).toBe('Bandeja')
  })
})
