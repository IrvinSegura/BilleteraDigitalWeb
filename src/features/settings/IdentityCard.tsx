import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useIdentityVerification } from '@/api/queries'
import { StatusBadge } from '@/components/StatusBadge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { identityStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

/** Where the customer's INE check stands, and the way to the page that sends it. */
export function IdentityCard() {
  const { t } = useTranslation()
  const verification = useIdentityVerification()
  const status = verification.data?.status
  const started = !!status && status !== 'NOT_STARTED'
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('identity.card.title')}</CardTitle>
        <CardDescription>{t('identity.card.description')}</CardDescription>
        {status && <CardAction><StatusBadge value={status} map={identityStatus} /></CardAction>}
      </CardHeader>
      <CardFooter>
        <Link to="/settings/identity" className={cn(buttonVariants({ variant: started ? 'outline' : 'default' }), 'w-full')}>
          {t(started ? 'identity.card.view' : 'identity.card.start')}
        </Link>
      </CardFooter>
    </Card>
  )
}
