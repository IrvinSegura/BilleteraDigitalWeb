/**
 * Staff (administrators and support agents) run the app and never hold money: wallets, transfers, bank accounts,
 * statements and the customer chat are for customers only. The API refuses them anyway; the app hides them.
 */
export function isStaff(role: string | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPPORT'
}

/** Where each role starts: customers at their dashboard, staff at their console. */
export function homeOf(role: string | undefined): string {
  if (role === 'ADMIN') {
    return '/admin'
  }
  if (role === 'SUPPORT') {
    return '/support/inbox'
  }
  return '/'
}
