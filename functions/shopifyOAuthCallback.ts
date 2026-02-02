import crypto from "node:crypto";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// Shopify HMAC verification
function verifyShopifyHmac(params: URLSearchParams, secret: string): boolean {
  const receivedHmac = params.get("hmac");
  if (!receivedHmac) return false;

  const message = Array.from(params.entries())
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const generatedHmac = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(generatedHmac),
    Buffer.from(receivedHmac)
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const params = url.searchParams;

  const shop = params.get("shop") || "";
  const code = params.get("code") || "";
  const state = params.get("state") || "";

  if (!shop || !code || !state) {
    return json({ error: "Missing required OAuth parameters" }, 400);
  }

  if (!shop.endsWith(".myshopify.com")) {
    return json({ error: "Invalid shop domain" }, 400);
  }

  const clientId = Deno.env.get("SHOPIFY_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET") || "";

  if (!clientId || !clientSecret) {
    return json({ error: "Missing Shopify secrets" }, 500);
  }

  // 1) Verify HMAC
  const hmacValid = verifyShopifyHmac(params, clientSecret);
  if (!hmacValid) {
    return json({ error: "Invalid Shopify HMAC" }, 401);
  }

  // 2) Validate OAuth state
  const base44 = await import("npm:@base44/sdk@0.8.6").then(m =>
    m.createClientFromRequest(req)
  );

  const states = await base44.asServiceRole.entities.OAuthState.filter({
    state,
    shop_domain: shop,
  });

  if (states.length === 0) {
    return json({ error: "Invalid or expired OAuth state" }, 400);
  }

  // 3) Exchange code for access token
  const tokenRes = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    }
  );

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return json({ error: "Token exchange failed", details: text }, 502);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return json({ error: "No access token returned" }, 500);
  }

  // 4) Save connection (upsert)
  const existing = await base44.asServiceRole.entities.ShopifyConnection.filter({
    shop_domain: shop,
  });

  if (existing.length > 0) {
    await base44.asServiceRole.entities.ShopifyConnection.update(existing[0].id, {
      access_token: accessToken,
      installed_at: new Date().toISOString(),
    });
  } else {
    await base44.asServiceRole.entities.ShopifyConnection.create({
      shop_domain: shop,
      access_token: accessToken,
      installed_at: new Date().toISOString(),
    });
  }

  // 5) Cleanup OAuth state
  await base44.asServiceRole.entities.OAuthState.delete(states[0].id);

  // 6) Redirect back to app
  return Response.redirect("https://jed-i.base44.app/Anslutningar");
});
