/**
 * HIZ YARIŞMASI — Cloudflare Worker
 * KV namespace: SCORES
 *
 * Endpoints:
 *   GET  /scores        → tüm skor listesini döner (JSON array, yüksekten düşüğe)
 *   POST /scores        → yeni skor kaydeder  { name, email, score, quizScore, reflexScore, date }
 *   DELETE /scores/:key → tek kayıt siler (opsiyonel, yönetim için)
 *
 * KV key yapısı: score:<timestamp>:<random>
 * Her key'in değeri: JSON string olarak bir skor objesi
 */

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const method = request.method;

    // Preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── GET /scores ──────────────────────────────────────────────
    if (method === "GET" && url.pathname === "/scores") {
      try {
        const list = await env.SCORES.list({ prefix: "score:" });
        const entries = await Promise.all(
          list.keys.map(async (k) => {
            const val = await env.SCORES.get(k.name);
            try { return JSON.parse(val); } catch { return null; }
          })
        );
        const sorted = entries
          .filter(Boolean)
          .sort((a, b) => b.score - a.score);

        return new Response(JSON.stringify(sorted), {
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
    }

    // ── POST /scores ─────────────────────────────────────────────
    if (method === "POST" && url.pathname === "/scores") {
      try {
        const body = await request.json();

        // Basit validasyon
        if (
          typeof body.name  !== "string" || body.name.trim() === "" ||
          typeof body.score !== "number" || isNaN(body.score)
        ) {
          return new Response(
            JSON.stringify({ error: "Geçersiz veri: name (string) ve score (number) zorunludur." }),
            { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
          );
        }

        const entry = {
          name:        body.name.trim(),
          email:       (body.email || "").trim(),
          score:       Math.round(body.score),
          quizScore:   Math.round(body.quizScore   || 0),
          reflexScore: Math.round(body.reflexScore || 0),
          date:        new Date().toISOString(),
        };

        const key = `score:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        // 90 günlük TTL (isteğe bağlı, kaldırabilirsin)
        await env.SCORES.put(key, JSON.stringify(entry), { expirationTtl: 60 * 60 * 24 * 90 });

        return new Response(JSON.stringify({ ok: true, key }), {
          status: 201,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
    }

    // ── DELETE /scores/:key ──────────────────────────────────────
    if (method === "DELETE" && url.pathname.startsWith("/scores/")) {
      const key = decodeURIComponent(url.pathname.replace("/scores/", ""));
      await env.SCORES.delete(key);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404, headers: CORS });
  },
};
