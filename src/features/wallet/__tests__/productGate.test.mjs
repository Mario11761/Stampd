import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { resolveWalletControlProductEnabled } from '../productGate.ts'

test('development builds expose the product regardless of the preview flag', () => {
  assert.equal(resolveWalletControlProductEnabled(true, undefined), true)
  assert.equal(resolveWalletControlProductEnabled(true, 'false'), true)
})

test('identity-preview exposes the product when development mode is false', () => {
  assert.equal(resolveWalletControlProductEnabled(false, 'true'), true)
})

test('production defaults to hidden and accepts only the exact internal flag', () => {
  assert.equal(resolveWalletControlProductEnabled(false, undefined), false)
  assert.equal(resolveWalletControlProductEnabled(false, ''), false)
  assert.equal(resolveWalletControlProductEnabled(false, 'false'), false)
  assert.equal(resolveWalletControlProductEnabled(false, 'TRUE'), false)
  assert.equal(resolveWalletControlProductEnabled(false, '1'), false)
})

test('EAS enables the non-secret flag only for identity-preview', async () => {
  const easConfig = JSON.parse(await readFile(new URL('../../../../eas.json', import.meta.url), 'utf8'))
  assert.equal(easConfig.build['identity-preview'].env.EXPO_PUBLIC_INTERNAL_IDENTITY_PREVIEW_ENABLED, 'true')
  assert.equal(easConfig.build['identity-preview'].developmentClient, false)
  assert.equal(easConfig.build.development.env?.EXPO_PUBLIC_INTERNAL_IDENTITY_PREVIEW_ENABLED, undefined)
})
