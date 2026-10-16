(() => {
  const config = window.VIDEOKU_CONFIG || { API_BASE_URL: "" };
  const apiBase = (config.API_BASE_URL || "").replace(/\/$/, "");
  const id = new URLSearchParams(location.search).get("id");
  const player = document.getElementById("playerShell");
  const title = document.getElementById("watchTitle");
  const meta = document.getElementById("watchMeta");
  const description = document.getElementById("watchDescription");
  const related = document.getElementById("relatedVideos");
  const safeUrl = value => { try { const u = new URL(value); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
  async function run() {
    try {
      const response = await fetch(apiBase ? `${apiBase}/api/videos` : "data/videos.json", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json(); const videos = Array.isArray(data) ? data : (data.videos || []);
      const video = videos.find(v => String(v.id) === String(id));
      if (!video) { title.textContent = "Video tidak ditemukan"; player.textContent = "Video ini tidak tersedia atau tautannya salah."; meta.textContent = ""; return; }
      document.title = `${video.title} — VideoKu`; title.textContent = video.title || "Tanpa judul";
      meta.textContent = `${video.category || "Lainnya"} · ${video.createdAt ? new Date(video.createdAt).toLocaleDateString("id-ID") : "VideoKu"}`;
      description.textContent = video.description || "Tidak ada deskripsi untuk video ini.";
      const src = safeUrl(video.videoUrl);
      if (!src) { player.textContent = "URL video tidak valid. Admin harus menggunakan URL HTTPS."; }
      else { const v = document.createElement("video"); v.className = "video-player"; v.controls = true; v.preload = "metadata"; v.playsInline = true; v.poster = safeUrl(video.thumbnail); v.src = src; v.textContent = "Browser kamu tidak mendukung pemutar video HTML5."; player.replaceChildren(v); }
      videos.filter(v => String(v.id) !== String(id)).slice(0, 8).forEach(v => {
        const a = document.createElement("a"); a.className = "related-card"; a.href = `watch.html?id=${encodeURIComponent(v.id || "")}`;
        const img = document.createElement("img"); img.loading = "lazy"; img.alt = ""; img.src = safeUrl(v.thumbnail) || "assets/thumbnail-placeholder.svg"; img.onerror = () => { img.onerror = null; img.src = "assets/thumbnail-placeholder.svg"; };
        const box = document.createElement("div"); const h = document.createElement("h3"); h.textContent = v.title || "Tanpa judul"; const p = document.createElement("p"); p.textContent = `VideoKu · ${v.category || "Lainnya"}`; box.append(h,p); a.append(img,box); related.append(a);
      });
    } catch { title.textContent = "Tidak dapat memuat video"; player.textContent = "Periksa koneksi API dan konfigurasi website."; }
  }
  document.getElementById("searchForm")?.addEventListener("submit", e => { e.preventDefault(); const q = document.getElementById("searchInput").value.trim(); location.href = `index.html${q ? `?q=${encodeURIComponent(q)}` : ""}`; });
  document.getElementById("menuToggle")?.addEventListener("click", () => document.getElementById("sidebar")?.classList.toggle("sidebar-open"));
  run();
})();
