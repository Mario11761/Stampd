import { seekerConfig } from './config'
import { parseSgtCheckResult, type SgtCheckResult } from './types'

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

export async function checkSgt(
  walletAddress: string,
  signal: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<SgtCheckResult> {
  const response = await fetcher(seekerConfig.endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ walletAddress }),
    signal,
  })

  const responseText = await response.text()
  if (responseText.length === 0 || responseText.length > seekerConfig.maxResponseCharacters) {
    throw new Error('Stampd received an invalid SGT response.')
  }

  let responseBody: unknown
  try {
    responseBody = JSON.parse(responseText)
  } catch {
    throw new Error('Stampd received an invalid SGT response.')
  }

  const result = parseSgtCheckResult(responseBody)
  if (result === null) {
    throw new Error('Stampd received an invalid SGT response.')
  }
  if (!response.ok && result.status !== 'unable') {
    throw new Error('Stampd could not verify SGT status.')
  }

  return result
}
