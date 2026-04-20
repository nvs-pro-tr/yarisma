// functions/api/scores.js
// GET  /api/scores  → tüm skorları döner
// POST /api/scores  → yeni skor kaydeder

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // GET — tüm skorları getir
  if (method === "GET") {
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
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  // POST — yeni skor kaydet
  if (method === "POST") {
    try {
      const body = await request.json();
      if (typeof body.name !== "string" || typeof body.score !== "number") {
        return new Response(JSON.stringify({ error: "Geçersiz veri" }), {
          status: 400, headers: { ...CORS, "Content-Type": "application/json" },
        });
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
      await env.SCORES.put(key, JSON.stringify(entry), {
        expirationTtl: 60 * 60 * 24 * 365, // 1 yıl
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 201, headers: { ...CORS, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Not Found", { status: 404, headers: CORS });
}
