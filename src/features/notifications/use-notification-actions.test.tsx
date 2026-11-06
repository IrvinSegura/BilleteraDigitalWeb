import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { stubApi } from '@/test/api'
import { currentLocation, renderWithProviders } from '@/test/render'

const api = stubApi()
const { useNotificationActions } = await import('./use-notification-actions')

function Opener({ type, referenceId }: { type: string; referenceId?: string }) {
  const { open } = useNotificationActions()
  return <button type="button" onClick={() => open({ id: 'n-1', type, referenceId, read: true })}>Abrir</button>
}

describe('useNotificationActions', () => {
  beforeEach(() => api.reset())

  it("takes an agent straight to the case they were assigned", async () => {
    renderWithProviders(<Opener type="SUPPORT_CASE_ASSIGNED" referenceId="case-1" />)

    await userEvent.click(screen.getByRole('button'))

    expect(currentLocation()).toBe('/support/inbox/case-1')
  })

  it.each(['SUPPORT_AGENT_JOINED', 'SUPPORT_AGENT_REPLIED', 'SUPPORT_CASE_RESOLVED'])('takes a user to their chat from %s', async (type) => {
    renderWithProviders(<Opener type={type} referenceId="case-1" />)

    await userEvent.click(screen.getByRole('button'))

    expect(currentLocation()).toBe('/support')
  })
})
