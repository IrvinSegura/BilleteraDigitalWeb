import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Route, Routes } from 'react-router'

import { FullPageLoader, GuestOnly, RequireAdmin, RequireAuth, RequireCustomer, RequireSupport } from '@/auth/RequireAuth'
import { Skeleton } from '@/components/Skeleton'
import { ConfirmEmailChangePage } from '@/features/auth/ConfirmEmailChangePage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'

// Sign-in and the dashboard ship in the main bundle; every other screen loads when first opened
const page = <T extends Record<string, React.ComponentType>>(load: () => Promise<T>, name: keyof T) =>
  lazy(() => load().then((module) => ({ default: module[name] as React.ComponentType })))

const WalletsPage = page(() => import('@/features/wallets/WalletsPage'), 'WalletsPage')
const WalletDetailPage = page(() => import('@/features/wallets/WalletDetailPage'), 'WalletDetailPage')
const StatementPage = page(() => import('@/features/wallets/StatementPage'), 'StatementPage')
const StatementsPage = page(() => import('@/features/statements/StatementsPage'), 'StatementsPage')
const ReceiptPage = page(() => import('@/features/wallets/ReceiptPage'), 'ReceiptPage')
const PayRequestPage = page(() => import('@/features/money/PayRequestPage'), 'PayRequestPage')
const DepositReturnPage = page(() => import('@/features/money/DepositReturnPage'), 'DepositReturnPage')
const BankAccountsPage = page(() => import('@/features/bank-accounts/BankAccountsPage'), 'BankAccountsPage')
const NotificationsPage = page(() => import('@/features/notifications/NotificationsPage'), 'NotificationsPage')
const SettingsPage = page(() => import('@/features/settings/SettingsPage'), 'SettingsPage')
const IdentityVerificationPage = page(() => import('@/features/identity/IdentityVerificationPage'), 'IdentityVerificationPage')
const SupportPage = page(() => import('@/features/support/SupportPage'), 'SupportPage')
const SupportInboxPage = page(() => import('@/features/support/SupportInboxPage'), 'SupportInboxPage')
const EscalatedPage = page(() => import('@/features/support/EscalatedPage'), 'EscalatedPage')
const AdminSupportPage = page(() => import('@/features/admin/AdminSupportPage'), 'AdminSupportPage')
const AdminUsersPage = page(() => import('@/features/admin/AdminUsersPage'), 'AdminUsersPage')
const AdminWalletsPage = page(() => import('@/features/admin/AdminWalletsPage'), 'AdminWalletsPage')
const AdminOperationsPage = page(() => import('@/features/admin/AdminOperationsPage'), 'AdminOperationsPage')
const AdminReconciliationsPage = page(() => import('@/features/admin/AdminReconciliationsPage'), 'AdminReconciliationsPage')
const AdminLedgerPage = page(() => import('@/features/admin/AdminLedgerPage'), 'AdminLedgerPage')
const AdminPaymentsPage = page(() => import('@/features/admin/AdminPaymentsPage'), 'AdminPaymentsPage')
const AdminAuditPage = page(() => import('@/features/admin/AdminAuditPage'), 'AdminAuditPage')
const AdminIdentityPage = page(() => import('@/features/admin/AdminIdentityPage'), 'AdminIdentityPage')
const AdminTicketsPage = page(() => import('@/features/admin/AdminTicketsPage'), 'AdminTicketsPage')
const AdminAdjustmentsPage = page(() => import('@/features/admin/AdminAdjustmentsPage'), 'AdminAdjustmentsPage')
const AdminHomePage = page(() => import('@/features/admin/AdminHomePage'), 'AdminHomePage')
const NotFoundPage = page(() => import('@/features/not-found/NotFoundPage'), 'NotFoundPage')

function PageFallback() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6" role="status" aria-busy aria-label={t('common.loading')}>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

const lazyPage = (element: React.ReactNode) => <Suspense fallback={<PageFallback />}>{element}</Suspense>

export function App() {
  // Subscribes the whole routed tree to the language: its elements are created here, so a change renders every screen
  // again, keeping its state, and what reads the language outside React (formats, labels, errors) refreshes too
  useTranslation()

  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route element={<GuestOnly />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
        </Route>
        {/* Emailed links work signed in or not */}
        <Route element={<AuthLayout />}>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AuthLayout />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>
          {/* Their own layout, without the app's navigation, so they print as documents */}
          <Route element={<RequireCustomer />}>
            <Route path="/wallets/:walletId/statement" element={lazyPage(<StatementPage />)} />
            <Route path="/wallets/:walletId/receipts/:transactionId" element={lazyPage(<ReceiptPage />)} />
          </Route>
          <Route element={<AppLayout />}>
            {/* Money is for customers only: staff land on their console */}
            <Route element={<RequireCustomer />}>
              <Route index element={<DashboardPage />} />
              <Route path="/wallets" element={lazyPage(<WalletsPage />)} />
              <Route path="/wallets/:walletId" element={lazyPage(<WalletDetailPage />)} />
              <Route path="/statements" element={lazyPage(<StatementsPage />)} />
              <Route path="/deposits/return" element={lazyPage(<DepositReturnPage />)} />
              {/* A payment link: signed-out payers sign in first and come back here */}
              <Route path="/send" element={lazyPage(<PayRequestPage />)} />
              <Route path="/bank-accounts" element={lazyPage(<BankAccountsPage />)} />
              <Route path="/support" element={lazyPage(<SupportPage />)} />
              <Route path="/settings/identity" element={lazyPage(<IdentityVerificationPage />)} />
            </Route>
            <Route path="/notifications" element={lazyPage(<NotificationsPage />)} />
            <Route path="/settings" element={lazyPage(<SettingsPage />)} />
            <Route path="/support/inbox" element={<RequireSupport />}>
              <Route index element={lazyPage(<SupportInboxPage />)} />
              <Route path=":conversationId" element={lazyPage(<SupportInboxPage />)} />
            </Route>
            <Route path="/support/escalated" element={<RequireSupport />}>
              <Route index element={lazyPage(<EscalatedPage />)} />
            </Route>
            <Route path="/admin" element={<RequireAdmin />}>
              <Route index element={lazyPage(<AdminHomePage />)} />
              <Route path="users" element={lazyPage(<AdminUsersPage />)} />
              <Route path="users/:userId" element={lazyPage(<AdminUsersPage />)} />
              <Route path="wallets" element={lazyPage(<AdminWalletsPage />)} />
              <Route path="operations" element={lazyPage(<AdminOperationsPage />)} />
              <Route path="reconciliations" element={lazyPage(<AdminReconciliationsPage />)} />
              <Route path="ledger" element={lazyPage(<AdminLedgerPage />)} />
              <Route path="payments" element={lazyPage(<AdminPaymentsPage />)} />
              <Route path="support" element={lazyPage(<AdminSupportPage />)} />
              <Route path="support/:conversationId" element={lazyPage(<AdminSupportPage />)} />
              <Route path="audit" element={lazyPage(<AdminAuditPage />)} />
              <Route path="identity" element={lazyPage(<AdminIdentityPage />)} />
              <Route path="identity/:verificationId" element={lazyPage(<AdminIdentityPage />)} />
              <Route path="tickets" element={lazyPage(<AdminTicketsPage />)} />
              <Route path="tickets/:ticketId" element={lazyPage(<AdminTicketsPage />)} />
              <Route path="adjustments" element={lazyPage(<AdminAdjustmentsPage />)} />
              <Route path="adjustments/:adjustmentId" element={lazyPage(<AdminAdjustmentsPage />)} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={lazyPage(<NotFoundPage />)} />
      </Routes>
    </Suspense>
  )
}
