import { MAILPIT_URL } from './env'

interface Summary {
  ID: string
}

/** The text of the newest email to address whose subject matches. Polled, like {@link emailedLink}. */
export async function emailedText(address: string, subject: string, timeoutMs = 15_000): Promise<string> {
  const query = encodeURIComponent(`to:"${address}" subject:"${subject}"`)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}&limit=1`)
    const [message] = ((await search.json()) as { messages: Summary[] }).messages
    if (message) {
      const { Text } = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`)).json()) as { Text: string }
      return Text
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`No "${subject}" email reached ${address}`)
}

/**
 * The link in the newest email to address whose subject matches, as the user would click it. The API sends
 * emails after its transaction commits, so it is polled for a while.
 */
export async function emailedLink(address: string, subject: string, path: string, timeoutMs = 15_000): Promise<string> {
  const query = encodeURIComponent(`to:"${address}" subject:"${subject}"`)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}&limit=1`)
    const [message] = ((await search.json()) as { messages: Summary[] }).messages
    if (message) {
      const { Text } = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`)).json()) as { Text: string }
      const link = Text.match(new RegExp(`https?://\\S+${path}\\S*`))?.[0]
      if (link) {
        return link
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`No "${subject}" email with a ${path} link reached ${address}`)
}
