const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const TOKEN_TTL_SECONDS = 6 * 60 * 60;
const MAX_BODY_BYTES = 20_000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...cors, "access-control-max-age": "86400" } });
    }
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/health" && request.method === "GET") return json({ ok: true, service: "VideoKu API" }, 200, cors);
      if (url.pathname === "/api/videos" && request.method === "GET") {
        const videos = await readVideos(env);
        return json(videos, 200, cors);
      }
      if (url.pathname === "/api/login" && request.method === "POST") {
        const body = await readJson(request);
        if (typeof body.password !== "string" || !env.ADMIN_PASSWORD || !env.JWT_SECRET) return json({ error: "Konfigurasi login belum lengkap." }, 500, cors);
        if (!(await constantTimeEqual(body.password, env.ADMIN_PASSWORD))) return json({ error: "Kata sandi salah." }, 401, cors);
        const token = await createToken(env.JWT_SECRET);
        return json({ token, expiresIn: TOKEN_TTL_SECONDS }, 200, cors);
      }
      if (url.pathname === "/api/videos" && request.method === "POST") {
        const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (!token || !(await verifyToken(token, env.JWT_SECRET))) return json({ error: "Sesi admin tidak valid atau sudah kedaluwarsa. Silakan masuk kembali." }, 401, cors);
        const body = await readJson(request);
        const video = validateVideo(body);
        const videos = await readVideos(env);
        if (videos.some(v => v.title.trim().toLowerCase() === video.title.trim().toLowerCase() && v.videoUrl === video.videoUrl)) return json({ error: "Video dengan judul dan URL yang sama sudah ada." }, 409, cors);
        videos.unshift({ id: crypto.randomUUID(), ...video, createdAt: new Date().toISOString() });
        if (videos.length > 5000) return json({ error: "Batas koleksi 5.000 video tercapai." }, 413, cors);
        await writeVideos(env, videos);
        return json({ ok: true, message: "Video berhasil disimpan ke GitHub.", videos }, 201, cors);
      }
      return json({ error: "Endpoint tidak ditemukan." }, 404, cors);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Terjadi kesalahan pada server. Periksa konfigurasi backend dan GitHub.";
      const status = error instanceof HttpError ? error.status : 500;
      return json({ error: message }, status, cors);
    }
  }
};

class HttpError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function corsHeaders(origin, env) {
  const allowed = (env.SITE_ORIGIN || "").replace(/\/$/, "");
  const headers = { "vary": "Origin", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "Content-Type, Authorization", "access-control-allow-origin": origin && origin === allowed ? origin : "null" };
  return headers;
}
function json(data, status, cors = {}) { return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...cors } }); }
async function readJson(request) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY_BYTES) throw new HttpError("Ukuran permintaan terlalu besar.", 413);
  let text; try { text = await request.text(); } catch { throw new HttpError("Isi permintaan tidak dapat dibaca."); }
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new HttpError("Ukuran permintaan terlalu besar.", 413);
  try { return JSON.parse(text || "{}"); } catch { throw new HttpError("Format JSON tidak valid."); }
}
function validateVideo(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const videoUrl = secureUrl(body.videoUrl, "URL video");
  const thumbnail = secureUrl(body.thumbnail, "URL thumbnail");
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!title || title.length > 120) throw new HttpError("Judul wajib diisi dan maksimal 120 karakter.");
  if (!category || category.length > 40) throw new HttpError("Kategori wajib diisi dan maksimal 40 karakter.");
  if (description.length > 3000) throw new HttpError("Deskripsi maksimal 3.000 karakter.");
  return { title, videoUrl, thumbnail, category, description };
}
function secureUrl(value, label) {
  if (typeof value !== "string" || value.length > 2048) throw new HttpError(`${label} tidak valid.`);
  let u; try { u = new URL(value); } catch { throw new HttpError(`${label} tidak valid.`); }
  if (u.protocol !== "https:" || !u.hostname || u.username || u.password) throw new HttpError(`${label} harus menggunakan HTTPS publik.`);
  return u.href;
}
function requireEnv(env, name) { if (!env[name]) throw new HttpError(`Secret/variable ${name} belum dikonfigurasi di Cloudflare.`, 500); return env[name]; }
function githubHeaders(env) { return { "authorization": `Bearer ${requireEnv(env, "GITHUB_TOKEN")}`, "accept": "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "VideoKu-Worker" }; }
function fileUrl(env) {
  const owner = encodeURIComponent(requireEnv(env, "GITHUB_OWNER"));
  const repo = encodeURIComponent(requireEnv(env, "GITHUB_REPO"));
  const branch = encodeURIComponent(env.GITHUB_BRANCH || "main");
  return `https://api.github.com/repos/${owner}/${repo}/contents/data/videos.json?ref=${branch}`;
}
function decodeBase64Utf8(value) { const binary = atob(value.replace(/\n/g, "")); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0)); return new TextDecoder().decode(bytes); }
function encodeBase64Utf8(value) { const bytes = new TextEncoder().encode(value); let binary = ""; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary); }
async function readVideos(env) {
  const response = await fetch(fileUrl(env), { headers: githubHeaders(env) });
  if (response.status === 404) throw new HttpError("File data/videos.json tidak ditemukan di branch GitHub yang dikonfigurasi.", 500);
  if (!response.ok) { const detail = await response.text(); throw new HttpError(`GitHub gagal membaca videos.json (HTTP ${response.status}). ${detail.slice(0, 160)}`, 502); }
  const file = await response.json();
  if (!file.content) throw new HttpError("GitHub mengembalikan file kosong atau format yang tidak didukung.", 502);
  let data; try { data = JSON.parse(decodeBase64Utf8(file.content)); } catch { throw new HttpError("Isi data/videos.json bukan JSON yang valid.", 500); }
  if (!Array.isArray(data)) throw new HttpError("data/videos.json harus berisi array JSON.", 500);
  return data;
}
async function writeVideos(env, videos) {
  const url = fileUrl(env);
  const currentResponse = await fetch(url, { headers: githubHeaders(env) });
  if (!currentResponse.ok) throw new HttpError(`Tidak dapat mengambil SHA file GitHub (HTTP ${currentResponse.status}).`, 502);
  const current = await currentResponse.json();
  const payload = { message: `VideoKu: perbarui daftar video (${new Date().toISOString()})`, content: encodeBase64Utf8(JSON.stringify(videos, null, 2) + "\n"), sha: current.sha, branch: env.GITHUB_BRANCH || "main" };
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(requireEnv(env, "GITHUB_OWNER"))}/${encodeURIComponent(requireEnv(env, "GITHUB_REPO"))}/contents/data/videos.json`, { method: "PUT", headers: { ...githubHeaders(env), "content-type": "application/json" }, body: JSON.stringify(payload) });
  if (response.status === 409 || response.status === 422) throw new HttpError("GitHub menolak penyimpanan karena konflik atau perubahan bersamaan. Muat ulang daftar video lalu coba lagi.", 409);
  if (!response.ok) { const detail = await response.text(); throw new HttpError(`Gagal menyimpan ke GitHub (HTTP ${response.status}). ${detail.slice(0, 180)}`, 502); }
}
function base64url(bytes) { let binary = ""; for (const b of bytes) binary += String.fromCharCode(b); return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
function fromBase64url(value) { const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4); const binary = atob(base64); return Uint8Array.from(binary, c => c.charCodeAt(0)); }
async function hmacKey(secret) { return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }
async function createToken(secret) {
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ sub: "admin", exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS, iat: Math.floor(Date.now() / 1000) })));
  const data = `${header}.${payload}`; const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(data));
  return `${data}.${base64url(new Uint8Array(sig))}`;
}
async function verifyToken(token, secret) {
  if (!secret || token.length > 4096) return false;
  const parts = token.split("."); if (parts.length !== 3) return false;
  try {
    const data = `${parts[0]}.${parts[1]}`;
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromBase64url(parts[2]), new TextEncoder().encode(data));
    if (!ok) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(parts[1])));
    return payload.sub === "admin" && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
async function constantTimeEqual(a, b) {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const aa = new Uint8Array(da), bb = new Uint8Array(db); let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}
