// Albus app shim: gives the portrait page the same small `window.claude.use(...)` surface it
// has on claude.ai, but backed by our own server (Claude, ElevenLabs, KV) and Safari's
// built-in speech recognition. The page code itself stays identical to the artifact.
(() => {
  "use strict";
  window.ALBUS_APP = true;

  /* ---------- access token ---------- */
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const hash = location.hash.match(/(?:^#|&)t=([^&]+)/);
  if (hash) {
    ls.set("albus.token", decodeURIComponent(hash[1]));
    history.replaceState(null, "", location.pathname);
  }
  let token = ls.get("albus.token") || "";
  function askToken() {
    const t = window.prompt("Zugangsschlüssel für Albus (APP_TOKEN):", "");
    if (t) { token = t.trim(); ls.set("albus.token", token); }
    return !!t;
  }
  async function api(path, init = {}, retry = true) {
    if (!token && !askToken()) throw Object.assign(new Error("no token"), { code: "not_granted" });
    const headers = Object.assign({}, init.headers, { "x-albus-token": token });
    const res = await fetch(path, Object.assign({}, init, { headers }));
    if (res.status === 401 && retry && askToken()) return api(path, init, false);
    return res;
  }

  /* ---------- config ---------- */
  const config = api("/api/config").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));

  /* ---------- sample: ask Claude through /api/chat, streamed ---------- */
  async function sample(input, opts = {}) {
    const messages = typeof input === "string" ? [{ role: "user", content: input }] : input;
    let res;
    try {
      res = await api("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, tier: opts.modelTier || "default" }),
        signal: opts.signal,
      });
    } catch (e) {
      throw { code: e && e.name === "AbortError" ? "cancelled" : e.code || "upstream_error", message: String(e) };
    }
    if (res.status === 401) throw { code: "not_granted", message: "token" };
    if (!res.ok || !res.body) throw { code: "upstream_error", message: "status " + res.status };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let text = "";
    for (;;) {
      let r;
      try { r = await reader.read(); }
      catch (e) { throw { code: opts.signal && opts.signal.aborted ? "cancelled" : "upstream_error", message: String(e), text }; }
      if (r.done) break;
      const delta = dec.decode(r.value, { stream: true });
      if (delta) { text += delta; try { opts.onText && opts.onText({ text, delta }); } catch {} }
    }
    if (!text.trim()) throw { code: "empty_completion", message: "empty" };
    return { text, truncated: false, modelTierApplied: opts.modelTier || "default" };
  }

  /* ---------- tts: ElevenLabs voice through /api/tts ---------- */
  const audio = new Audio();
  audio.setAttribute("playsinline", "");
  // a valid 0.2 s silent WAV, played once inside the first tap to unlock audio on iOS
  const SILENT = (() => {
    const n = 4410, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 22050, true); v.setUint32(28, 44100, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, "data"); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  })();
  let unlocked = false;
  document.addEventListener("pointerdown", () => {
    if (unlocked) return;
    unlocked = true;
    audio.src = SILENT;
    audio.play().catch(() => {});
  }, { capture: true });
  const ttsListeners = new Set();
  let ttsState = "idle", ttsAbort = null;
  function setTts(state, reason) {
    ttsState = state;
    ttsListeners.forEach((f) => { try { f(reason ? { state, reason } : { state }); } catch {} });
  }
  const tts = {
    async speak(what) {
      const text = (Array.isArray(what) ? what.map((l) => l.text).join("\n") : String(what || "")).trim();
      if (!text) throw { code: "invalid_argument", message: "empty" };
      if (ttsAbort) ttsAbort("replaced");
      let aborted = null;
      const stopped = new Promise((_, rej) => { ttsAbort = (reason) => { aborted = reason; rej({ code: "stopped", reason }); }; });
      stopped.catch(() => {});
      setTts("starting");
      try {
        const res = await Promise.race([
          api("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }),
          stopped,
        ]);
        if (!res.ok || res.status === 204) throw { code: "unavailable", message: "status " + res.status };
        const blob = await Promise.race([res.blob(), stopped]);
        const url = URL.createObjectURL(blob);
        audio.src = url;
        const started = performance.now();
        await Promise.race([audio.play(), stopped]);
        setTts("speaking");
        await Promise.race([new Promise((r) => { audio.onended = r; audio.onerror = r; }), stopped]);
        URL.revokeObjectURL(url);
        setTts("idle", "completed");
        return { playedMs: performance.now() - started };
      } catch (e) {
        if (!aborted) setTts("idle", e && e.code === "unavailable" ? "unavailable" : "upstream_error");
        throw e && e.code ? e : { code: "upstream_error", message: String(e) };
      } finally {
        ttsAbort = null;
      }
    },
    async stop() {
      audio.pause();
      if (ttsAbort) ttsAbort("stopped");
      if (ttsState !== "idle") setTts("idle", "stopped");
    },
    add(what) { return tts.speak(what); },
    async pause() { audio.pause(); },
    async resume() { return audio.play(); },
    async setRate() {},
    active() { return ttsState !== "idle"; },
    async voices() { return ["rounded"]; },
    onState(f) { ttsListeners.add(f); if (ttsState !== "idle") f({ state: ttsState }); return () => ttsListeners.delete(f); },
    onLine() { return () => {}; },
    onPosition() { return () => {}; },
  };

  /* ---------- dictation: Safari / Chrome speech recognition ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function makeDictation() {
    const partialL = new Set(), finalL = new Set(), stateL = new Set();
    let rec = null, wanted = false, state = "idle", restarts = 0, lastFinal = "";
    const emitState = (s, reason) => { state = s; stateL.forEach((f) => { try { f(reason ? { state: s, reason } : { state: s }); } catch {} }); };
    function build(lang) {
      const r = new SR();
      r.lang = lang || "de-DE";
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (ev) => {
        let partial = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) {
            const piece = (lastFinal ? " " : "") + t.trim();
            lastFinal = t;
            finalL.forEach((f) => { try { f({ text: piece }); } catch {} });
          } else partial += t;
        }
        partialL.forEach((f) => { try { f({ text: partial.trim() }); } catch {} });
        restarts = 0;
      };
      r.onerror = (ev) => {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") { wanted = false; emitState("idle", "not_granted"); }
      };
      r.onend = () => {
        if (wanted && restarts < 30) {
          restarts++;
          setTimeout(() => { if (wanted) { try { r.start(); } catch { wanted = false; emitState("idle", "upstream_error"); } } }, 250);
        } else if (state !== "idle") emitState("idle", wanted ? "upstream_error" : "stopped");
      };
      return r;
    }
    return {
      start(opts) {
        if (wanted) return Promise.resolve();
        return new Promise((resolve, reject) => {
          try {
            rec = rec || build(opts && opts.language ? opts.language : "de-DE");
            wanted = true; lastFinal = "";
            emitState("starting");
            rec.onstart = () => { emitState("listening"); resolve(); };
            rec.start();
          } catch (e) {
            wanted = false; emitState("idle", "upstream_error");
            reject({ code: "upstream_error", message: String(e) });
          }
        });
      },
      async stop() {
        if (!rec || !wanted) return;
        wanted = false;
        emitState("finishing");
        try { rec.stop(); } catch {}
      },
      active() { return state !== "idle"; },
      onPartial(f) { partialL.add(f); return () => partialL.delete(f); },
      onFinal(f) { finalL.add(f); return () => finalL.delete(f); },
      onState(f) { stateL.add(f); if (state !== "idle") f({ state }); return () => stateL.delete(f); },
    };
  }

  /* ---------- db: documents on our server ---------- */
  function docRef(path) {
    const get = async () => {
      const r = await api("/api/doc?path=" + encodeURIComponent(path));
      if (!r.ok) throw { code: "unavailable", message: "status " + r.status };
      const j = await r.json();
      const data = j.exists ? j.data : undefined;
      return { id: path.split("/").pop(), exists: !!j.exists, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } };
    };
    return {
      id: path.split("/").pop(), path, get,
      async set(data) {
        const r = await api("/api/doc?path=" + encodeURIComponent(path), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
        if (!r.ok) throw { code: "unavailable", message: "status " + r.status };
      },
      async update(data) { const s = await get(); await this.set(Object.assign({}, s.data() || {}, data)); },
      async delete() { await api("/api/doc?path=" + encodeURIComponent(path), { method: "DELETE" }); },
      onSnapshot(next, error) {
        let alive = true;
        const tick = () => get().then((s) => alive && next(s)).catch((e) => alive && error && error(e));
        tick();
        const id = setInterval(tick, 15 * 60 * 1000);
        return () => { alive = false; clearInterval(id); };
      },
    };
  }
  const db = {
    doc: docRef,
    collection(path) { return { path, doc: (id) => docRef(path + "/" + (id || crypto.randomUUID())) }; },
  };

  const user = {
    async id() { return "leo"; },
    async me() { return { id: "leo", name: "Leo" }; },
    async isOwner() { return true; },
    async canEdit() { return true; },
    async can() { return true; },
    async profiles() { return {}; },
  };

  const assets = {
    async upload(blob) {
      const r = await api("/api/asset", { method: "POST", headers: { "content-type": blob.type || "image/jpeg" }, body: blob });
      if (!r.ok) throw { code: "upstream_error", message: "status " + r.status };
      return r.json();
    },
  };

  /* ---------- ElevenLabs voice agent: tap the portrait, then just talk ---------- */
  let conv = null, idleTimer = 0, agentId = null, toolBusy = 0;
  config.then((c) => { agentId = (c && c.agentId) || null; });
  function bump() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (conv && !toolBusy) conv.endSession().catch(() => {}); else if (conv) bump(); }, 60000);
  }
  window.albusTap = () => {
    const H = window.albusHooks;
    if (!agentId || !window.ElevenLabsClient || !H) return false;
    if (conv || window.albusSessionActive) { if (conv) conv.endSession().catch(() => {}); return true; }
    window.albusSessionActive = true;
    H.listening();
    H.caption("Einen Moment …");
    const safe = (f, d) => { try { return f() || d; } catch { return d; } };
    window.ElevenLabsClient.Conversation.startSession({
      agentId,
      dynamicVariables: {
        gedaechtnis: safe(() => H.memoryText(), "(noch nichts)").slice(0, 6000),
        zuletzt: safe(() => H.recentText(), "(nichts)").slice(0, 3000),
        wetter: safe(() => H.weather(), "unbekannt").slice(0, 1500),
        zustand: safe(() => H.life(), "Fawkes ist kräftig und in voller Pracht.").slice(0, 800),
      },
      clientTools: {
        merken: ({ notiz }) => { safe(() => H.remember(notiz)); return "gemerkt"; },
        geste: ({ was }) => { safe(() => H.action(was)); return "ok"; },
        nachdenken: async ({ sekunden }) => {
          toolBusy++;
          try { await H.thinkAway(Math.max(12, Math.min(45, +sekunden || 25))); }
          finally { toolBusy--; bump(); }
          return "Du bist zurück im Sessel und hast nachgedacht. Gib jetzt deine durchdachte Antwort, kurz.";
        },
      },
      onConnect: () => { bump(); },
      onDisconnect: () => {
        conv = null; window.albusSessionActive = false; window.albusMouthLevel = null;
        clearTimeout(idleTimer); H.done();
      },
      onError: () => { H.caption("Meine Stimme hakt gerade. Tippe gleich noch einmal ins Bild."); },
      onModeChange: ({ mode }) => { H.speaking(mode === "speaking"); bump(); },
      onMessage: (m) => {
        if (!m || !m.message) return;
        const you = (m.role || m.source) === "user";
        H.caption(m.message, you); safe(() => H.log(you ? "user" : "assistant", m.message)); bump();
      },
    }).then((c) => {
      conv = c;
      window.albusMouthLevel = () => { try { return c.getOutputVolume(); } catch { return 0; } };
    }).catch(() => {
      window.albusSessionActive = false;
      H.caption("Mikrofon oder Verbindung haben nicht geklappt. Tippe noch einmal ins Bild.");
      H.done();
    });
    return true;
  };

  window.claude = {
    async use(name) {
      switch (name) {
        case "sample": return sample;
        case "tts": return (await config).tts ? tts : null;
        case "dictation": return SR ? makeDictation() : null;
        case "db": return db;
        case "user": return user;
        case "assets": return assets;
        default: return null;
      }
    },
  };
})();
