/**
 * How to reach support for someone who can't sign in, since the support chat needs a session. Set by
 * VITE_SUPPORT_EMAIL; without it there is nothing to offer, so nothing shows.
 */
export function SupportContact({ question }: { question: string }) {
  const email = import.meta.env.VITE_SUPPORT_EMAIL
  if (!email) return null
  return (
    <p className="text-center text-sm text-muted-foreground">
      {question}{' '}
      <a href={`mailto:${email}`} className="font-medium text-primary hover:underline">{email}</a>
    </p>
  )
}
