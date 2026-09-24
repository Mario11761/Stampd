import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { getDemoPassportStats } from '../src/data/mockLoyalty.ts'

const BASELINE = '155dca381584e9a312e0bf728101dd27c71e519e'
const PRODUCT_COPY_FILES = [
  'app/index.tsx',
  'app/passport.tsx',
  'app/stamp-success.tsx',
  'app/rewards.tsx',
  'app/reward/[id].tsx',
  'src/components/LoyaltyCard.tsx',
  'src/components/RewardCard.tsx',
]

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

test('passport statistics are derived from the two visible merchant programs', async () => {
  assert.deepEqual(getDemoPassportStats(false), { stamps: 6, places: 2, eligibilityReady: 0 })
  assert.deepEqual(getDemoPassportStats(true), { stamps: 7, places: 2, eligibilityReady: 1 })

  const passport = await read('app/passport.tsx')
  assert.match(passport, /label="Eligible Programs" value=\{stats\.eligibilityReady\}/)
  assert.doesNotMatch(passport, /Demo Ready/)
})

test('misleading reward ownership and readiness wording is absent from product UI', async () => {
  const source = (await Promise.all(PRODUCT_COPY_FILES.map(read))).join('\n')

  for (const misleading of [
    'SKR Earned',
    'REWARD UNLOCKED',
    'Reward Ready',
    'Available Rewards',
    'Your reward is ready',
    '>REWARD</Text>',
  ]) {
    assert.doesNotMatch(source, new RegExp(misleading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('every relevant reward surface includes visible no-transfer and no-claim copy', async () => {
  const surfaces = ['app/passport.tsx', 'app/stamp-success.tsx', 'app/rewards.tsx', 'app/reward/[id].tsx']

  for (const surface of surfaces) {
    const source = await read(surface)
    assert.match(source, /No SKR has been transferred or claimed\./, surface)
  }
})

test('reward UI contains no Claim or Redeem action', async () => {
  const source = (await Promise.all(PRODUCT_COPY_FILES.map(read))).join('\n')
  assert.doesNotMatch(source, />\s*Claim\s*</)
  assert.doesNotMatch(source, />\s*Redeem\s*</)
  assert.doesNotMatch(source, /accessibility(?:Label|Hint)=["'][^"']*\b(?:claim|redeem)\b/i)
})

test('judge-facing Verified Seeker explanation states both required inputs', async () => {
  const passport = await read('app/passport.tsx')
  assert.match(passport, /Official SGT \+ current wallet control = a Verified Seeker session\./)
})

test('welcome copy describes local loyalty without an onchain-stamp claim or mock wording', async () => {
  const welcome = await read('app/index.tsx')
  assert.match(welcome, /A Seeker-native/)
  assert.match(welcome, /local loyalty stamps and demo/)
  assert.doesNotMatch(welcome, /onchain loyalty passport/i)
  assert.doesNotMatch(welcome, /mock loyalty passport/i)
})

test('demo documentation preserves the exact accepted compact QR payload', async () => {
  const payload = '{"v":1,"type":"stampd_demo_stamp","merchantId":"seeker-coffee","stampId":"seeker-coffee-demo-5"}'
  assert.match(await read('README.md'), new RegExp(payload.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(await read('docs/DEMO.md'), new RegExp(payload.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('SKR figures are explicitly presented as demo targets rather than balances', async () => {
  const loyaltyCard = await read('src/components/LoyaltyCard.tsx')
  const rewardCard = await read('src/components/RewardCard.tsx')
  const detail = await read('app/reward/[id].tsx')
  const success = await read('app/stamp-success.tsx')

  assert.match(loyaltyCard, /DEMO REWARD TARGET/)
  assert.match(loyaltyCard, /currency\} target/)
  assert.match(rewardCard, /currency\} TARGET/)
  assert.match(detail, /DEMO REWARD TARGET/)
  assert.match(success, /DEMO REWARD TARGET/)
})

test('Rewards card uses ordinary detail navigation and imports no wallet capability', async () => {
  const rewards = await read('app/rewards.tsx')
  const rewardCard = await read('src/components/RewardCard.tsx')
  const combined = `${rewards}\n${rewardCard}`

  assert.match(rewards, /router\.push\(\{ pathname: '\/reward\/\[id\]'/)
  assert.match(rewards, /<RewardCard[\s\S]*onPress=/)
  assert.match(rewardCard, /onPress\?: \(\) => void/)
  assert.doesNotMatch(combined, /features\/wallet|authorize\(|transact\(|signMessage|signTransaction|sendTransaction/)
})

test('Reward Detail uses a generic Back label and preserves ordinary back navigation', async () => {
  const detail = await read('app/reward/[id].tsx')

  assert.match(detail, /accessibilityLabel="Back"/)
  assert.match(detail, /<Text style=\{styles\.backLabel\}>Back<\/Text>/)
  assert.match(detail, /onPress=\{\(\) => router\.back\(\)\}/)
  assert.doesNotMatch(detail, /features\/wallet|authorize\(|transact\(|signMessage|signTransaction|sendTransaction/)
  assert.doesNotMatch(detail, />\s*(?:Claim|Redeem)\s*</)
})

test('protected wallet, verification, SGT, native, dependency, and patch paths match the baseline', () => {
  const protectedPaths = [
    'src/features/wallet',
    'src/features/verification',
    'src/features/seeker',
    'android',
    'app.json',
    'eas.json',
    'package.json',
    'package-lock.json',
    'patches',
  ]
  const changed = execFileSync('git', ['diff', '--name-only', BASELINE, '--', ...protectedPaths], {
    encoding: 'utf8',
  }).trim()

  assert.equal(changed, '')
})
