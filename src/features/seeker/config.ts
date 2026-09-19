export const seekerConfig = {
  endpoint: 'https://sgt.stampdpass.com/v1/sgt/check',
  requestTimeoutMs: 12_000,
  maxResponseCharacters: 8_192,
} as const
