(() => {
  const config = window.VIDEOKU_CONFIG || { API_BASE_URL: "" };
  const apiBase = (config.API_BASE_URL || "").replace(/\/$/, "");
  const loginPanel = document.getElementById("loginPanel");
  const dashboardPanel = document.getElementById("dashboardPanel");
  const notice = document.getElementById("notice");
  const loginForm = document.getElementById("loginForm");
  const videoForm = document.getElementById("videoForm");
  const saveButton = document.getElementById("saveVideoButton");
  const list = document.getElementById("adminVideoList");
  let token = sessionStorage.getItem("videoku_admin_token") || "";
  let videos = [];
  function showNotice(message, type = "info") { notice.textContent = message; notice.className = `notice ${type}`; notice.classList.remove("hidden"); notice.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  function hideNotice() { notice.classList.add("hidden"); }
  function setLoggedIn(value) { loginPanel.classList.toggle("hidden", value); dashboardPanel.classList.toggle("hidden", !value); }
  async function api(path, options = {}) {
    if (!apiBase) throw new Error("API belum diatur. Isi API_BASE_URL di assets/config.js dengan URL Cloudflare Worker.");
    const headers = { "content-type": "application/json", ...(options.headers || {}) };
    if (options.auth && token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${apiBase}${path}`, { ...options, headers, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { if (response.status === 401 && options.auth) { logout(false); } throw new Error(data.error || `Permintaan gagal (HTTP ${response.status}).`); }
    return data;
  }
  function logout(show = true) { token = ""; sessionStorage.removeItem("videoku_admin_token"); setLoggedIn(false); if (show) showNotice("Kamu sudah keluar dari panel admin.", "success"); }
  async function loadVideos() {
    list.replaceChildren(); const loading = document.createElement("p"); loading.className = "muted"; loading.textContent = "Memuat data…"; list.append(loading);
    try {
      const data = await api("/api/videos"); videos = Array.isArray(data) ? data : (data.videos || []); renderList();
    } catch (error) { list.replaceChildren(); const p = document.createElement("p"); p.className = "muted"; p.textContent = error.message; list.append(p); }
  }
  function renderList() {
    list.replaceChildren();
    if (!videos.length) { const p = document.createElement("p"); p.className = "muted"; p.textContent = "Belum ada video. Tambahkan video pertama melalui formulir."; list.append(p); return; }
    videos.forEach(video => {
      const row = document.createElement("div"); row.className = "admin-video-row";
      const img = document.createElement("img"); img.alt = ""; img.src = video.thumbnail || "assets/thumbnail-placeholder.svg"; img.onerror = () => { img.onerror = null; img.src = "assets/thumbnail-placeholder.svg"; };
      const text = document.createElement("div"); const h = document.createElement("h3"); h.textContent = video.title || "Tanpa judul"; const p = document.createElement("p"); p.textContent = `${video.category || "Lainnya"} · ${video.createdAt ? new Date(video.createdAt).toLocaleDateString("id-ID") : ""}`; const link = document.createElement("p"); link.textContent = video.videoUrl || ""; text.append(h,p,link); row.append(img,text); list.append(row);
    });
  }
  loginForm.addEventListener("submit", async event => {
    event.preventDefault(); hideNotice(); const password = document.getElementById("adminPassword").value;
    const button = loginForm.querySelector("button[type=submit]"); button.disabled = true; button.textContent = "Memeriksa…";
    try { const result = await api("/api/login", { method: "POST", body: JSON.stringify({ password }) }); token = result.token; sessionStorage.setItem("videoku_admin_token", token); document.getElementById("adminPassword").value = ""; setLoggedIn(true); showNotice("Berhasil masuk. Kamu dapat menambahkan video.", "success"); await loadVideos(); }
    catch (error) { showNotice(error.message, "error"); }
    finally { button.disabled = false; button.textContent = "Masuk"; }
  });
  videoForm.addEventListener("submit", async event => {
    event.preventDefault(); hideNotice(); saveButton.disabled = true; saveButton.textContent = "Menyimpan ke GitHub…";
    const fd = new FormData(videoForm); const payload = { title: String(fd.get("title") || "").trim(), videoUrl: String(fd.get("videoUrl") || "").trim(), thumbnail: String(fd.get("thumbnail") || "").trim(), category: String(fd.get("category") || "").trim(), description: String(fd.get("description") || "").trim() };
    try { const result = await api("/api/videos", { method: "POST", auth: true, body: JSON.stringify(payload) }); videos = result.videos || []; renderList(); videoForm.reset(); showNotice("Video berhasil disimpan ke GitHub. Perubahan pada halaman GitHub Pages mungkin membutuhkan waktu beberapa menit untuk terbit.", "success"); }
    catch (error) { showNotice(error.message, "error"); }
    finally { saveButton.disabled = false; saveButton.textContent = "Simpan video ke GitHub"; }
  });
  document.getElementById("refreshVideos").addEventListener("click", loadVideos);
  document.getElementById("logoutButton").addEventListener("click", () => logout(true));
  if (token) { setLoggedIn(true); loadVideos(); } else { setLoggedIn(false); }
  if (!apiBase) showNotice("Konfigurasi belum lengkap: setelah deploy Worker, isi API_BASE_URL di assets/config.js.", "info");
})();
