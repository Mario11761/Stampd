const ASSET_LINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.stampd.app",
      sha256_cert_fingerprints: [
        "D6:0F:A9:94:5A:4E:FA:99:E9:C5:46:6F:11:E7:81:0F:CB:87:30:5A:4A:72:E9:CC:9C:CA:4D:FC:EB:EC:8F:7B",
      ],
    },
  },
];

const ASSET_LINKS_BODY = `${JSON.stringify(ASSET_LINKS, null, 2)}\n`;

const ROOT_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Stampd</title>
    <style>
      :root { color-scheme: dark; font-family: system-ui, sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #111827; color: #f9fafb; }
      main { width: min(36rem, calc(100% - 3rem)); text-align: center; }
      h1 { margin: 0 0 1rem; font-size: clamp(3rem, 12vw, 6rem); letter-spacing: -0.06em; }
      p { margin: 0.6rem 0; color: #d1d5db; font-size: 1.125rem; }
      .rhythm { color: #a7f3d0; font-weight: 700; }
      small { display: block; margin-top: 2.5rem; color: #9ca3af; }
    </style>
  </head>
  <body>
    <main>
      <h1>Stampd</h1>
      <p>Your onchain loyalty passport.</p>
      <p class="rhythm">Scan. Sign. Stamp. Earn.</p>
      <p>Built for Solana Mobile.</p>
      <small>This site establishes Stampd's public application identity.</small>
    </main>
  </body>
</html>
`;

const SECURITY_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function response(body, status, contentType, method) {
  return new Response(method === "HEAD" ? null : body, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "Cache-Control": "public, max-age=300",
      "Content-Type": contentType,
    },
  });
}

async function iconResponse(request, env) {
  if (!env?.ASSETS) {
    return response(
      "Identity icon unavailable\n",
      503,
      "text/plain; charset=utf-8",
      request.method,
    );
  }

  const iconUrl = new URL("/stampd-icon.png", request.url);
  const assetResponse = await env.ASSETS.fetch(
    new Request(iconUrl, { method: "GET" }),
  );

  if (!assetResponse.ok) {
    return response(
      "Identity icon unavailable\n",
      503,
      "text/plain; charset=utf-8",
      request.method,
    );
  }

  const headers = new Headers(assetResponse.headers);
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("Content-Type", "image/png");
  headers.set("Referrer-Policy", SECURITY_HEADERS["Referrer-Policy"]);
  headers.set(
    "X-Content-Type-Options",
    SECURITY_HEADERS["X-Content-Type-Options"],
  );
  headers.delete("Location");
  headers.delete("Set-Cookie");

  return new Response(request.method === "HEAD" ? null : assetResponse.body, {
    status: 200,
    headers,
  });
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed\n", {
        status: 405,
        headers: {
          ...SECURITY_HEADERS,
          Allow: "GET, HEAD",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    const { pathname } = new URL(request.url);

    if (pathname === "/.well-known/assetlinks.json") {
      return response(
        ASSET_LINKS_BODY,
        200,
        "application/json",
        request.method,
      );
    }

    if (pathname === "/stampd-icon.png") {
      return iconResponse(request, env);
    }

    if (pathname === "/") {
      return response(
        ROOT_PAGE,
        200,
        "text/html; charset=utf-8",
        request.method,
      );
    }

    return response(
      "Not Found\n",
      404,
      "text/plain; charset=utf-8",
      request.method,
    );
  },
};
