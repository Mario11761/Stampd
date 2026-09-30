# Stampd identity Worker

This isolated Cloudflare Worker serves Stampd's public identity page and
Digital Asset Links statement. It contains no wallet code, credentials,
analytics, trackers, or backend data access.

The DAL response is deliberately constructed with the exact header:

```text
Content-Type: application/json
```

## Local validation

From this folder:

```powershell
node .\test\validate.mjs
```

## Manual deployment

Deployment requires the owner's Cloudflare account. Do not store an API token
in this folder.

1. Sign in through Wrangler's browser-based OAuth flow:

   ```powershell
   npx wrangler login
   ```

2. Deploy exactly one Worker from this folder:

   ```powershell
   npx wrangler deploy
   ```

3. Record the origin printed by Wrangler. It will normally be:

   ```text
   https://stampd-identity.<your-workers-subdomain>.workers.dev
   ```

4. Verify the root page and DAL URL in a browser:

   ```text
   https://stampd-identity.<your-workers-subdomain>.workers.dev/
   https://stampd-identity.<your-workers-subdomain>.workers.dev/.well-known/assetlinks.json
   ```

5. Verify the live GET response without following redirects:

   ```powershell
   curl.exe --silent --show-error --dump-header - --output NUL --max-redirs 0 https://stampd-identity.<your-workers-subdomain>.workers.dev/.well-known/assetlinks.json
   ```

   The result must show `HTTP 200` and exactly
   `Content-Type: application/json`, with no `Location` header.

6. Run the exact Google Digital Asset Links relationship check, substituting
   the deployed origin for `<NEW_ORIGIN>`:

   ```text
   https://digitalassetlinks.googleapis.com/v1/assetlinks:check?source.web.site=<URL_ENCODED_NEW_ORIGIN>&relation=delegate_permission/common.handle_all_urls&target.androidApp.packageName=com.stampd.app&target.androidApp.certificate.sha256Fingerprint=D6:0F:A9:94:5A:4E:FA:99:E9:C5:46:6F:11:E7:81:0F:CB:87:30:5A:4A:72:E9:CC:9C:CA:4D:FC:EB:EC:8F:7B
   ```

Do not change the Stampd mobile application until the deployed endpoint passes
all header, JSON, fingerprint, and Google DAL checks.
