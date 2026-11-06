import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
import { useUser } from '@/auth/auth-context'
import { saveFile } from '@/lib/download'

import { fetchWalletStatement, type WalletStatement } from './statement-data'

export interface StatementRequest {
  month: string
  /** The wallets it covers, read from the API when the request doesn't already bring their statements. */
  wallets: { id: string; currency: string }[]
  general: boolean
  /** Statements the page already has on screen, so they aren't read twice. */
  statements?: WalletStatement[]
}

/** Builds a statement as a PDF and hands it to the browser to save. */
export function useStatementDownload() {
  const { t } = useTranslation()
  const user = useUser()
  return useMutation({
    mutationFn: async (request: StatementRequest) => {
      const [statements, pdf] = await Promise.all([
        request.statements
          ?? Promise.all(request.wallets.map((wallet) => fetchWalletStatement(wallet.id, wallet.currency, request.month))),
        // The PDF libraries start loading while the movements are read
        import('./statement-pdf'),
      ])
      const document = {
        holder: { fullName: user.fullName ?? '', email: user.email ?? '' },
        month: request.month,
        wallets: statements,
        general: request.general,
      }
      saveFile(await pdf.buildStatementPdf(document), pdf.statementFileName(document))
    },
    onSuccess: () => toast.success(t('statements.downloaded')),
    onError: (error) => toast.error(errorMessage(error)),
  })
}
