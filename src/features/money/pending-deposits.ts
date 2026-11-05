// A deposit that left for the provider's checkout: the return page only gets the deposit id back, and the API
// reads it under its wallet, so the wallet id is kept for the trip (this tab only).
const PREFIX = 'wallet.pendingDeposit.'

export function rememberPendingDeposit(depositId: string, walletId: string) {
  try {
    sessionStorage.setItem(PREFIX + depositId, walletId)
  } catch {
    // Storage blocked: the return page then falls back to the wallets list
  }
}

export function pendingDepositWallet(depositId: string): string | null {
  try {
    return sessionStorage.getItem(PREFIX + depositId)
  } catch {
    return null
  }
}

export function forgetPendingDeposit(depositId: string) {
  try {
    sessionStorage.removeItem(PREFIX + depositId)
  } catch {
    // Nothing to clean up
  }
}
