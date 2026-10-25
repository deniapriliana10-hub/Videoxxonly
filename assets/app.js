(() => {
  const config = window.VIDEOKU_CONFIG || { API_BASE_URL: "" };
  const apiBase = (config.API_BASE_URL || "").replace(/\/$/, "");
  const grid = document.getElementById("videoGrid");
  const count = document.getElementById("videoCount");
  const chips = document.getElementById("categoryChips");
  const empty = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  let videos = [];
  let category = "Semua";
  let search = new URLSearchParams(location.search).get("q") || "";
  let mode = "";
  if (searchInput) searchInput.value = search;

  const safeUrl = (value) => { try { const u = new URL(value); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
  const formatDate = (value) => { if (!value) return "VideoKu"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "VideoKu" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); };
  async function loadVideos() {
    try {
      const url = apiBase ? `${apiBase}/api/videos` : "data/videos.json";
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Gagal mengambil daftar video");
      const data = await response.json();
      videos = Array.isArray(data) ? data : (Array.isArray(data.videos) ? data.videos : []);
      videos.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      renderCategories(); renderVideos();
    } catch (error) {
      grid.innerHTML = "";
      const box = document.createElement("div"); box.className = "error-state";
      box.textContent = "Daftar video belum dapat dimuat. Periksa koneksi API atau isi data/videos.json.";
      grid.append(box);
    }
  }
  function renderCategories() {
    const cats = [...new Set(videos.map(v => String(v.category || "Lainnya").trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, "id"));
    chips.replaceChildren();
    ["Semua", ...cats].forEach(cat => {
      const btn = document.createElement("button"); btn.className = `chip${cat === category ? " selected" : ""}`; btn.type = "button"; btn.textContent = cat; btn.dataset.category = cat;
      btn.addEventListener("click", () => { category = cat; renderCategories(); renderVideos(); }); chips.append(btn);
    });
  }
  function videoCard(video) {
    const link = document.createElement("a"); link.className = "video-card"; link.href = `watch.html?id=${encodeURIComponent(video.id || "")}`;
    const thumb = document.createElement("div"); thumb.className = "thumbnail-wrap";
    const img = document.createElement("img"); img.loading = "lazy"; img.alt = video.title || "Thumbnail video"; img.src = safeUrl(video.thumbnail) || "assets/thumbnail-placeholder.svg"; img.onerror = () => { img.onerror = null; img.src = "assets/thumbnail-placeholder.svg"; };
    const play = document.createElement("span"); play.className = "thumbnail-play"; play.textContent = "▶"; thumb.append(img, play);
    const details = document.createElement("div"); details.className = "video-card-details";
    const avatar = document.createElement("div"); avatar.className = "channel-avatar"; avatar.textContent = "V";
    const text = document.createElement("div"); text.className = "video-card-text";
    const title = document.createElement("h3"); title.textContent = video.title || "Tanpa judul";
    const channel = document.createElement("p"); channel.className = "video-channel"; channel.textContent = "VideoKu";
    const meta = document.createElement("p"); meta.className = "video-meta"; meta.textContent = `${video.category || "Lainnya"} · ${formatDate(video.createdAt)}`;
    text.append(title, channel, meta); details.append(avatar, text); link.append(thumb, details); return link;
  }
  function renderVideos() {
    const q = search.trim().toLocaleLowerCase("id");
    let filtered = videos.filter(v => {
      const matchesCategory = category === "Semua" || String(v.category || "Lainnya") === category;
      const haystack = `${v.title || ""} ${v.description || ""} ${v.category || ""}`.toLocaleLowerCase("id");
      return matchesCategory && haystack.includes(q);
    });
    if (mode === "Terbaru") filtered.sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    grid.replaceChildren(); filtered.forEach(v => grid.append(videoCard(v)));
    count.textContent = `${filtered.length} video`;
    empty.classList.toggle("hidden", filtered.length > 0);
    grid.classList.toggle("hidden", filtered.length === 0);
  }
  document.getElementById("searchForm")?.addEventListener("submit", e => { e.preventDefault(); search = searchInput.value; renderVideos(); });
  searchInput?.addEventListener("input", () => { search = searchInput.value; renderVideos(); });
  document.getElementById("clearSearch")?.addEventListener("click", () => { search = ""; category = "Semua"; mode = ""; searchInput.value = ""; renderCategories(); renderVideos(); });
  document.querySelectorAll("[data-filter]").forEach(btn => btn.addEventListener("click", () => { mode = btn.dataset.filter; category = "Semua"; renderCategories(); renderVideos(); document.querySelectorAll("[data-filter]").forEach(x => x.classList.toggle("active", x === btn)); }));
  document.getElementById("menuToggle")?.addEventListener("click", () => document.getElementById("sidebar")?.classList.toggle("sidebar-open"));
  loadVideos();
})();
