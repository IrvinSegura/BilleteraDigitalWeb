import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { MAX_SUGGESTIONS, type Suggestion, SuggestInput, useSuggestions } from './SuggestInput'

const people: Suggestion[] = Array.from({ length: 9 }, (_, i) => ({
  value: `ana${i}@correo.com`,
  title: `Ana ${i}`,
  detail: `ana${i}@correo.com`,
}))

function Field({ fetchPeople, onPick, onSubmit }: {
  fetchPeople: (text: string) => Promise<Suggestion[]>
  onPick?: (suggestion: Suggestion) => void
  onSubmit?: (value: string) => void
}) {
  const [value, setValue] = useState('')
  const preview = useSuggestions(['test', fetchPeople], value, fetchPeople)
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit?.(value) }}>
      <SuggestInput aria-label="Buscar" value={value} onValueChange={setValue} onPick={onPick}
        suggestions={preview.suggestions} loading={preview.loading} noMatches={preview.settled} />
      <button type="submit">Enviar</button>
    </form>
  )
}

function renderField(props: Parameters<typeof Field>[0]) {
  const client = new QueryClient()
  return render(<QueryClientProvider client={client}><Field {...props} /></QueryClientProvider>)
}

describe('SuggestInput', () => {
  it('previews only a few of the matches, without asking for each keystroke', async () => {
    const fetchPeople = vi.fn(async () => people)
    renderField({ fetchPeople })

    await userEvent.type(screen.getByLabelText('Buscar'), 'ana')

    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(MAX_SUGGESTIONS))
    expect(fetchPeople).toHaveBeenCalledTimes(1)
    expect(fetchPeople.mock.calls[0]![0 as never]).toBe('ana')
  })

  it('does not look up a single letter', async () => {
    const fetchPeople = vi.fn(async () => people)
    renderField({ fetchPeople })

    await userEvent.type(screen.getByLabelText('Buscar'), 'a')
    await new Promise((resolve) => setTimeout(resolve, 350))

    expect(fetchPeople).not.toHaveBeenCalled()
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('says so when nothing matches', async () => {
    renderField({ fetchPeople: async () => [] })

    await userEvent.type(screen.getByLabelText('Buscar'), 'zzz')

    expect(await screen.findByText('Sin coincidencias')).toBeInTheDocument()
  })

  it('fills the field with a clicked row and tells the screen', async () => {
    const onPick = vi.fn()
    renderField({ fetchPeople: async () => people, onPick })
    const input = screen.getByLabelText<HTMLInputElement>('Buscar')

    await userEvent.type(input, 'ana')
    await userEvent.click(await screen.findByRole('option', { name: /Ana 2/ }))

    expect(input.value).toBe('ana2@correo.com')
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ value: 'ana2@correo.com' }))
  })

  it('picks with the arrows and Enter without submitting the form', async () => {
    const onPick = vi.fn()
    const onSubmit = vi.fn()
    renderField({ fetchPeople: async () => people, onPick, onSubmit })

    await userEvent.type(screen.getByLabelText('Buscar'), 'ana')
    await screen.findAllByRole('option')
    await userEvent.keyboard('{ArrowDown}{Enter}')

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ value: 'ana0@correo.com' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits what was typed on Enter with no row highlighted', async () => {
    const onSubmit = vi.fn()
    renderField({ fetchPeople: async () => people, onSubmit })

    await userEvent.type(screen.getByLabelText('Buscar'), 'ana@correo.com')
    await userEvent.keyboard('{Enter}')

    expect(onSubmit).toHaveBeenCalledWith('ana@correo.com')
  })
})
