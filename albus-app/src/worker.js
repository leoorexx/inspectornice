// Albus – Server für Dumbledores Porträt.
// Liefert die Seite aus, hält die API-Schlüssel geheim und speichert Gedächtnis, Bild und Wetter.
import Anthropic from "@anthropic-ai/sdk";
import { DurableObject } from "cloudflare:workers";
import { INDEX_HTML, APP_SHIM_JS, ELEVENLABS_JS } from "./static.js";

// One small storage object holds memory, portrait and weather (SQLite-backed Durable Object).
export class AlbusStore extends DurableObject {
  async getValue(key) { return (await this.ctx.storage.get(key)) ?? null; }
  async putValue(key, value) { await this.ctx.storage.put(key, value); }
  async deleteValue(key) { await this.ctx.storage.delete(key); }
}
const store = (env) => env.STORE.get(env.STORE.idFromName("albus"));

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const SEG = "(?!\\.\\.?(?:/|$))[A-Za-z0-9_\\-.~:@+]{1,200}";
const PATH_OK = new RegExp(`^${SEG}(?:/${SEG}){1,15}$`);
const WEATHER_PATH = "weather/bornheim";

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return staticFile(url.pathname);

    // Uploaded portrait images are addressed by an unguessable id, so <img> and fetch can load them.
    const asset = url.pathname.match(/^\/api\/asset\/([0-9a-f-]{36})$/);
    if (asset && req.method === "GET") return assetGet(env, asset[1]);

    if (!env.APP_TOKEN || req.headers.get("x-albus-token") !== env.APP_TOKEN) {
      return json({ error: "unauthorized" }, 401);
    }
    try {
      switch (url.pathname) {
        case "/api/config":
          return json({ tts: !!(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID), chat: !!env.ANTHROPIC_API_KEY, agentId: env.ELEVENLABS_AGENT_ID || null });
        case "/api/chat":
          if (req.method === "POST") return chat(req, env, ctx);
          break;
        case "/api/tts":
          if (req.method === "POST") return tts(req, env);
          break;
        case "/api/doc":
          return doc(req, env, url);
        case "/api/asset":
          if (req.method === "POST") return assetPut(req, env);
          break;
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: "server error" }, 500);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(updateWeather(env));
  },
};

function staticFile(path) {
  if (path === "/" || path === "/index.html") {
    return new Response(INDEX_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
  }
  if (path === "/vendor/elevenlabs-client-1.35.0.js") {
    return new Response(ELEVENLABS_JS, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=604800" } });
  }
  if (path === "/app-shim.js") {
    return new Response(APP_SHIM_JS, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" } });
  }
  return new Response("Nicht gefunden", { status: 404 });
}

/* ------------------------------------------------------------------ */
/* Claude                                                              */
/* ------------------------------------------------------------------ */
async function chat(req, env, ctx) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: "no api key" }, 503);
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) return json({ error: "bad request" }, 400);

  const messages = body.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 30000) }));
  // The page sends its standing instructions as the first user turn; they become the system prompt.
  let system;
  if (messages.length > 1 && messages[0].role === "user") system = messages.shift().content;
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "bad request" }, 400);

  const model = env.ALBUS_MODEL || "claude-opus-5-5";
  const effort = body.tier === "quick" ? "low" : "medium";
  // Server-side refusal fallback where the model supports it.
  const fallbacks = /^claude-(opus-5|fable-5|mythos-5|sonnet-5-5)/.test(model);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const run = (async () => {
    try {
      const params = { model, max_tokens: 4000, messages, output_config: { effort } };
      if (system) params.system = system;
      const stream = fallbacks
        ? client.beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
        : client.messages.stream(params);
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
          await writer.write(enc.encode(ev.delta.text));
        }
      }
    } catch (e) {
      console.error("chat failed", e?.status, e?.message);
    } finally {
      await writer.close().catch(() => {});
    }
  })();
  ctx.waitUntil(run);
  return new Response(readable, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

/* ------------------------------------------------------------------ */
/* Voice (ElevenLabs)                                                  */
/* ------------------------------------------------------------------ */
async function tts(req, env) {
  if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) return new Response(null, { status: 204 });
  const body = await req.json().catch(() => null);
  const text = body && typeof body.text === "string" ? body.text.trim().slice(0, 2500) : "";
  if (!text) return json({ error: "no text" }, 400);
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
        voice_settings: { stability: 0.55, similarity_boost: 0.75 },
      }),
    },
  );
  if (!r.ok) {
    console.error("tts failed", r.status, await r.text().catch(() => ""));
    return json({ error: "tts failed" }, 502);
  }
  return new Response(r.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
}

/* ------------------------------------------------------------------ */
/* Documents (memory, portrait, weather)                               */
/* ------------------------------------------------------------------ */
async function doc(req, env, url) {
  const path = url.searchParams.get("path") || "";
  if (!PATH_OK.test(path)) return json({ error: "bad path" }, 400);
  const key = "doc:" + path;
  if (req.method === "GET") {
    let data = await store(env).getValue(key);
    if (path === WEATHER_PATH && (!data || Date.now() - Date.parse(data.updatedAt) > 12 * 3600e3)) {
      data = (await updateWeather(env).catch((e) => (console.error("weather", e), null))) || data;
    }
    return json(data ? { exists: true, data } : { exists: false });
  }
  if (req.method === "PUT") {
    const text = await req.text();
    if (text.length > 256 * 1024) return json({ error: "too large" }, 413);
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "bad body" }, 400);
    await store(env).putValue(key, data);
    return json({ ok: true });
  }
  if (req.method === "DELETE") {
    await store(env).deleteValue(key);
    return json({ ok: true });
  }
  return json({ error: "method" }, 405);
}

async function assetPut(req, env) {
  const type = (req.headers.get("content-type") || "").split(";")[0];
  if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return json({ error: "unsupported type" }, 415);
  const buf = await req.arrayBuffer();
  if (buf.byteLength > 1.9 * 1024 * 1024) return json({ error: "too large" }, 413);
  const id = crypto.randomUUID();
  await store(env).putValue("asset:" + id, { type, bytes: new Uint8Array(buf) });
  return json({ id, url: "/api/asset/" + id, sizeBytes: buf.byteLength, contentType: type });
}

async function assetGet(env, id) {
  const v = await store(env).getValue("asset:" + id);
  if (!v) return new Response("not found", { status: 404 });
  return new Response(v.bytes, {
    headers: { "content-type": v.type || "image/jpeg", "cache-control": "private, max-age=31536000, immutable" },
  });
}

/* ------------------------------------------------------------------ */
/* Weather: Deutscher Wetterdienst via Bright Sky, Frankfurt-Bornheim  */
/* ------------------------------------------------------------------ */
const COND = { dry: "trocken", fog: "Nebel", rain: "Regen", sleet: "Schneeregen", snow: "Schnee", hail: "Hagel", thunderstorm: "Gewitter" };
const sky = (cc) => (cc == null ? "unbestimmt" : cc < 20 ? "klar" : cc < 45 ? "heiter" : cc < 80 ? "wolkig" : "bedeckt");
const berlinDate = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(d);

export async function updateWeather(env) {
  const from = berlinDate(new Date());
  const to = berlinDate(new Date(Date.now() + 3 * 86400e3));
  const r = await fetch(
    `https://api.brightsky.dev/weather?lat=50.1247&lon=8.7072&date=${from}&last_date=${to}&tz=Europe/Berlin`,
    { headers: { accept: "application/json" } },
  );
  if (!r.ok) throw new Error("brightsky " + r.status);
  const doc = summarizeWeather((await r.json()).weather || [], new Date());
  await store(env).putValue("doc:" + WEATHER_PATH, doc);
  return doc;
}

export function summarizeWeather(hours, now) {
  const byDay = new Map();
  for (const h of hours) {
    const d = h.timestamp.slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(h);
  }
  const labels = ["heute", "morgen", "übermorgen"];
  const days = [...byDay.entries()].sort().slice(0, 3).map(([date, hs], i) => {
    const temps = hs.map((h) => h.temperature).filter((t) => t != null);
    const rain = hs.reduce((s, h) => s + (h.precipitation || 0), 0);
    const probs = hs.map((h) => h.precipitation_probability).filter((p) => p != null);
    const dayHours = hs.filter((h) => { const hr = +h.timestamp.slice(11, 13); return hr >= 8 && hr <= 18; });
    const cc = dayHours.map((h) => h.cloud_cover).filter((c) => c != null);
    const wet = hs.map((h) => h.condition).filter((c) => c && c !== "dry");
    const counts = wet.reduce((m, c) => ((m[c] = (m[c] || 0) + 1), m), {});
    const main = wet.length ? Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] : "dry";
    const gust = Math.max(0, ...hs.map((h) => h.wind_gust_speed || 0));
    return {
      date, label: labels[i] || date,
      min: Math.round(Math.min(...temps)), max: Math.round(Math.max(...temps)),
      rain_mm: Math.round(rain * 10) / 10, rain_prob: probs.length ? Math.max(...probs) : null,
      sky: sky(cc.length ? cc.reduce((a, b) => a + b, 0) / cc.length : null),
      wet: COND[main] || main, gust_kmh: Math.round(gust),
    };
  });
  const cur = hours.reduce((best, h) =>
    !best || Math.abs(Date.parse(h.timestamp) - now) < Math.abs(Date.parse(best.timestamp) - now) ? h : best, null);
  const line = (x) => {
    let s = `${x.label}: ${x.sky}, ${x.min} bis ${x.max} °C`;
    s += x.wet !== "trocken" && x.rain_mm >= 0.3 ? `, ${x.wet} (etwa ${x.rain_mm} mm)` : ", trocken";
    if (x.gust_kmh >= 45) s += `, Böen bis ${x.gust_kmh} km/h`;
    return s;
  };
  return {
    place: "Frankfurt-Bornheim",
    source: "Deutscher Wetterdienst über Bright Sky",
    updatedAt: new Date().toISOString(),
    now: cur ? { temp: Math.round(cur.temperature * 10) / 10, condition: COND[cur.condition] || cur.condition, sky: sky(cur.cloud_cover), at: cur.timestamp } : null,
    days,
    summary: days.map(line).join("; "),
  };
}
