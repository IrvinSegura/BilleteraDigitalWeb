import { useQuery } from '@tanstack/react-query'

import { api, type Schemas, unwrap } from '@/api/client'

export type Conversation = Schemas['ConversationResponse']
export type Message = Schemas['MessageResponse']
export type Attachment = Schemas['AttachmentResponse']

export const SUPPORT_QUERY_KEY = ['support', 'conversation'] as const

// There is no push for chats yet: while someone may write, the conversation is read again this often
const POLL_MS = 3_000

/** The API's limit, checked here too so a big file doesn't travel just to be refused. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const ACCEPTED_FILES = 'image/jpeg,image/png,image/webp,application/pdf,video/mp4'
export const MAX_TEXT_LENGTH = 2000

/** While it waits for a person or is with one, the other side can change it at any moment. */
export function pollsWhileOpen(status: string | undefined) {
  return status === 'QUEUED' || status === 'ASSIGNED' ? POLL_MS : false
}

/** The conversation of whoever is signed in; null when they can just start writing. */
export function useConversation() {
  return useQuery<Conversation | null>({
    queryKey: SUPPORT_QUERY_KEY,
    queryFn: async () => (await unwrap(api.GET('/api/v1/support/conversation'))) ?? null,
    refetchInterval: (query) => pollsWhileOpen(query.state.data?.status),
  })
}

/** The form an attachment travels in, with its optional text. */
export function attachmentForm(file: File, text?: string) {
  const form = new FormData()
  form.append('file', file)
  if (text?.trim()) {
    form.append('text', text.trim())
  }
  return { body: {} as never, bodySerializer: () => form }
}

export function formatFileSize(bytes: number | undefined) {
  const size = bytes ?? 0
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
}
