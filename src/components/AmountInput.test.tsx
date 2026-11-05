import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { AmountInput } from './AmountInput'

function Field() {
  const [value, setValue] = useState('')
  return <AmountInput currency="MXN" value={value} onValueChange={setValue} aria-label="Monto" />
}

async function typeAmount(text: string) {
  render(<Field />)
  const input = screen.getByLabelText('Monto')
  await userEvent.type(input, text)
  return input
}

describe('AmountInput', () => {
  it('shows the currency beside the field', () => {
    render(<Field />)
    expect(screen.getByText('MXN')).toBeInTheDocument()
  })

  it('keeps a decimal amount as typed', async () => {
    expect(await typeAmount('1250.75')).toHaveValue('1250.75')
  })

  it('drops letters, signs and separators', async () => {
    expect(await typeAmount('-1,2a3')).toHaveValue('123')
  })

  it('allows at most two decimals', async () => {
    expect(await typeAmount('9.999')).toHaveValue('9.99')
  })

  it('allows only one decimal point', async () => {
    expect(await typeAmount('1.2.3')).toHaveValue('1.23')
  })

  it('allows at most 12 whole digits', async () => {
    expect(await typeAmount('12345678901234')).toHaveValue('123456789012')
  })
})
