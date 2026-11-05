import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

/** Previous/next for the API's pages, which say whether there is a next one but not how many there are. */
export function Pager({ page, hasNext, onPageChange, disabled }: {
  page: number
  hasNext: boolean
  onPageChange: (page: number) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  if (page === 0 && !hasNext) {
    return null
  }
  return (
    <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
      <span className="text-xs text-muted-foreground">{t('common.page', { page: page + 1 })}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={disabled || page === 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft /> {t('common.previous')}
        </Button>
        <Button variant="outline" size="sm" disabled={disabled || !hasNext} onClick={() => onPageChange(page + 1)}>
          {t('common.next')} <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
