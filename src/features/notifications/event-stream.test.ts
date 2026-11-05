import { describe, expect, it } from 'vitest'

import { parseEventStream } from './event-stream'

describe('parseEventStream', () => {
  it('reads named events and keeps an unfinished one for the next chunk', () => {
    const { events, rest } = parseEventStream(
      'event:ready\ndata:{}\n\n:ping\n\nevent:notification\nid:1\ndata:{"title":"Hola"}\n\nevent:notif')

    expect(events).toEqual([
      { event: 'ready', data: '{}' },
      { event: 'notification', data: '{"title":"Hola"}' },
    ])
    expect(rest).toBe('event:notif')
    expect(parseEventStream(`${rest}ication\ndata:{}\n\n`).events).toEqual([{ event: 'notification', data: '{}' }])
  })

  it('joins data lines, trims one leading space and accepts CRLF', () => {
    expect(parseEventStream('data: a\r\ndata: b\r\n\r\n').events).toEqual([{ event: 'message', data: 'a\nb' }])
  })

  it('skips heartbeats and events without data', () => {
    expect(parseEventStream(':ping\n\nevent:empty\n\n').events).toEqual([])
  })
})
