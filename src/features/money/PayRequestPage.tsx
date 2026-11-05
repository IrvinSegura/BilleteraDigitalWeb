import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import i18n from '@/i18n'

import { useMoneyActions } from './MoneyActions'
import { parsePaymentLink } from './payment-link'

/** Where a payment link lands: opens "Enviar dinero" filled in with the request, over the dashboard. */
export function PayRequestPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { open } = useMoneyActions()
  // Strict mode runs the effect twice; the dialog opens once
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true
    const request = parsePaymentLink(params)
    navigate('/', { replace: true })
    if (request) {
      open('transfer', undefined, request)
    } else {
      toast.error(i18n.t('money.request.invalidLink'))
    }
  }, [params, navigate, open])

  return null
}
