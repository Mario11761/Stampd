#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const EXPECTED_VERSION = '2.3.0'
const PACKAGE_NAME = '@solana-mobile/mobile-wallet-adapter-protocol'
const projectRoot = path.resolve(__dirname, '..')
const packageRoot = path.join(projectRoot, 'node_modules', ...PACKAGE_NAME.split('/'))
const packageJsonPath = path.join(packageRoot, 'package.json')
const bridgePath = path.join(
  packageRoot,
  'android',
  'src',
  'main',
  'java',
  'com',
  'solanamobile',
  'mobilewalletadapter',
  'reactnative',
  'SolanaMobileWalletAdapterModule.kt',
)

function fail(message) {
  console.error(`MWA sensitive-log verification FAILED: ${message}`)
  process.exit(1)
}

if (!fs.existsSync(packageJsonPath)) {
  fail(`${PACKAGE_NAME} is not installed`)
}

const installedPackage = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
if (installedPackage.version !== EXPECTED_VERSION) {
  fail(`expected ${PACKAGE_NAME} ${EXPECTED_VERSION}, found ${installedPackage.version}`)
}

if (!fs.existsSync(bridgePath)) {
  fail('the Android native bridge was not found at the expected path')
}

const bridge = fs.readFileSync(bridgePath, 'utf8')
const safeInvokeLog = 'Log.d(TAG, "invoke `$method`")'
const safeFailureLog = 'Log.e(TAG, "Failed to invoke `$method` (${e.javaClass.simpleName})")'

if (!bridge.includes(safeInvokeLog)) {
  fail('the method-only invoke log is missing')
}

if (!bridge.includes(safeFailureLog)) {
  fail('the sanitized invoke failure log is missing')
}

const forbiddenFragments = [
  'with params $params',
  'params $params',
  'Log.d(TAG, "invoke `$method` with params',
  'Log.e(TAG, "Failed to invoke `$method` with params',
]

for (const fragment of forbiddenFragments) {
  if (bridge.includes(fragment)) {
    fail(`forbidden parameter-bearing native log found: ${fragment}`)
  }
}

const unsafeLogLines = bridge
  .split(/\r?\n/u)
  .filter((line) => /\bLog\.[deiwv]\s*\(/u.test(line) && /(\bparams\b|auth_token|authToken)/u.test(line))

if (unsafeLogLines.length > 0) {
  fail('a native log statement references RPC parameters or an authorization token')
}

console.log(
  `MWA sensitive-log verification PASS (${PACKAGE_NAME} ${EXPECTED_VERSION}; native RPC params and throwable details are not logged)`,
)
