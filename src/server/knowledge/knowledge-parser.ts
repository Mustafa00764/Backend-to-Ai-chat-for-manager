type ParsedKnowledgeMessage = {
  senderRole: string
  senderName?: string | null
  content: string
  sentAt?: string | null
}

export type ParsedKnowledgeConversation = {
  externalId?: string | null
  title: string
  rawText: string
  messages: ParsedKnowledgeMessage[]
  metadata?: Record<string, unknown>
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function textToMessages(rawText: string): ParsedKnowledgeMessage[] {
  const lines = rawText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return []
  }

  return lines.map(line => {
    const managerMatch = line.match(
      /^(manager|менеджер|admin|operator|оператор)\s*:\s*(.+)$/i
    )
    const clientMatch = line.match(
      /^(client|customer|клиент|покупатель)\s*:\s*(.+)$/i
    )

    if (managerMatch) {
      return {
        senderRole: 'MANAGER',
        senderName: null,
        content: managerMatch[2].trim()
      }
    }

    if (clientMatch) {
      return {
        senderRole: 'CUSTOMER',
        senderName: null,
        content: clientMatch[2].trim()
      }
    }

    return {
      senderRole: 'UNKNOWN',
      senderName: null,
      content: line
    }
  })
}

function parseJsonl(content: string): ParsedKnowledgeConversation[] {
  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const conversations: ParsedKnowledgeConversation[] = []

  for (const [index, line] of lines.entries()) {
    const item = JSON.parse(line) as {
      externalId?: string
      title?: string
      rawText?: string
      text?: string
      messages?: Array<{
        role?: string
        senderRole?: string
        senderName?: string
        content?: string
        text?: string
        sentAt?: string
      }>
      metadata?: Record<string, unknown>
    }

    const messages =
      item.messages
        ?.map(message => ({
          senderRole: normalizeText(
            message.senderRole || message.role || 'UNKNOWN'
          ),
          senderName: normalizeText(message.senderName) || null,
          content: normalizeText(message.content || message.text),
          sentAt: normalizeText(message.sentAt) || null
        }))
        .filter(message => message.content.length > 0) ?? []

    const rawText =
      normalizeText(item.rawText || item.text) ||
      messages
        .map(message => `${message.senderRole}: ${message.content}`)
        .join('\n')

    if (!rawText) {
      continue
    }

    conversations.push({
      externalId: normalizeText(item.externalId) || `jsonl-${index + 1}`,
      title: normalizeText(item.title) || `Разговор ${index + 1}`,
      rawText,
      messages: messages.length > 0 ? messages : textToMessages(rawText),
      metadata: item.metadata ?? {}
    })
  }

  return conversations
}

function parseTxt(
  content: string,
  fileName: string
): ParsedKnowledgeConversation[] {
  const cleanText = content.trim()

  if (!cleanText) {
    return []
  }

  const parts = cleanText
    .split(/\n-{3,}\n|\n={3,}\n/g)
    .map(part => part.trim())
    .filter(Boolean)

  return parts.map((part, index) => ({
    externalId: `txt-${index + 1}`,
    title: parts.length === 1 ? fileName : `${fileName} — часть ${index + 1}`,
    rawText: part,
    messages: textToMessages(part),
    metadata: {
      parser: 'txt',
      partIndex: index
    }
  }))
}

export function parseKnowledgeFile({
  fileName,
  content
}: {
  fileName: string
  content: string
}) {
  const lowerName = fileName.toLowerCase()

  if (lowerName.endsWith('.jsonl')) {
    return parseJsonl(content)
  }

  return parseTxt(content, fileName)
}
