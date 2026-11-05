/** One server-sent event: its name (`message` when the server gave none) and its data lines joined. */
export interface StreamEvent {
  event: string
  data: string
}

/**
 * Reads the complete events in `buffer` (the stream's text so far) and returns them with what is left over, an
 * event still arriving. Comments (heartbeats) are skipped. Follows the event-stream format closely enough for
 * this API's events: `event:`, `data:` and `id:` fields, blank lines between events.
 */
export function parseEventStream(buffer: string): { events: StreamEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n?/g, '\n')
  const blocks = normalized.split('\n\n')
  const rest = blocks.pop() ?? ''
  const events: StreamEvent[] = []
  for (const block of blocks) {
    let event = 'message'
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
      if (field === 'event') event = value
      if (field === 'data') data.push(value)
    }
    if (data.length) events.push({ event, data: data.join('\n') })
  }
  return { events, rest }
}
