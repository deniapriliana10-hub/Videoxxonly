
(() => {
  "use strict";

  const config = window.VIDEOKU_CONFIG || {};
  const apiBase = String(config.API_BASE_URL || "").replace(/\/+$/, "");

  const grid = document.getElementById("videoGrid");
  const count = document.getElementById("videoCount");
  const chips = document.getElementById("categoryChips");
  const empty = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menuToggle");

  if (!grid || !chips || !empty) {
    console.error("Elemen utama VideoKu tidak ditemukan.");
    return;
  }

  let videos = [];
  let category = "Semua";
  let search = new URLSearchParams(location.search).get("q") || "";
  let mode = "";

  if (searchInput) searchInput.value = search;

  function safeUrl(value) {
    try {
      const url = new URL(value, location.href);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function formatViews(value) {
    const views = Number(value);
    const safeViews = Number.isFinite(views) && views > 0
      ? Math.floor(views)
      : 0;

    return `${safeViews.toLocaleString("id-ID")} views`;
  }

  async function loadVideos() {
    const sources = [];

    if (apiBase) sources.push(`${apiBase}/api/videos`);
    sources.push(new URL("data/videos.json", document.baseURI).href);

    let lastError;

    for (const source of [...new Set(sources)]) {
      try {
        const response = await fetch(source, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.videos)
            ? data.videos
            : null;

        if (!list) throw new Error("Format data video tidak valid");

        videos = list.filter(video =>
          video && typeof video === "object"
        );

        videos.sort((a, b) =>
          String(b.createdAt || "").localeCompare(
            String(a.createdAt || "")
          )
        );

        renderCategories();
        renderVideos();

        window.dispatchEvent(new Event("videoku-app-started"));
        console.log("Video berhasil dimuat:", source);
        return;
      } catch (error) {
        lastError = error;
        console.warn("Gagal memuat sumber video:", source, error);
      }
    }

    grid.classList.remove("hidden");
    grid.replaceChildren();

    const box = document.createElement("div");
    box.className = "error-state";

    const message = document.createElement("p");
    message.textContent =
      "Daftar video gagal dimuat. Periksa koneksi API atau data/videos.json.";

    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Coba lagi";
    retry.addEventListener("click", loadVideos);

    box.append(message, retry);
    grid.append(box);

    console.error("Semua sumber video gagal:", lastError);
  }

  function renderCategories() {
    const categories = [
      ...new Set(
        videos
          .map(video => String(video.category || "Lainnya").trim())
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b, "id"));

    chips.replaceChildren();

    ["Semua", ...categories].forEach(cat => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `chip${cat === category ? " selected" : ""}`;
      button.textContent = cat;
      button.dataset.category = cat;

      button.addEventListener("click", () => {
        category = cat;
        renderCategories();
        renderVideos();
      });

      chips.append(button);
    });
  }

  function videoCard(video) {
    const link = document.createElement("a");
    link.className = "video-card";
    link.href = `watch.html?id=${encodeURIComponent(video.id || "")}`;

    const thumbnail = document.createElement("div");
    thumbnail.className = "thumbnail-wrap";

    const image = document.createElement("img");
    image.loading = "lazy";
    image.alt = video.title || "Thumbnail video";
    image.src =
      safeUrl(video.thumbnail) || "assets/thumbnail-placeholder.svg";

    image.onerror = () => {
      image.onerror = null;
      image.src = "assets/thumbnail-placeholder.svg";
    };

    const play = document.createElement("span");
    play.className = "thumbnail-play";
    play.textContent = "▶";
    play.setAttribute("aria-hidden", "true");

    thumbnail.append(image, play);

    const details = document.createElement("div");
    details.className = "video-card-details";

    const avatar = document.createElement("div");
    avatar.className = "channel-avatar";
    avatar.textContent = "V";
    avatar.setAttribute("aria-hidden", "true");

    const text = document.createElement("div");
    text.className = "video-card-text";

    const title = document.createElement("h3");
    title.textContent = video.title || "Tanpa judul";

    const channel = document.createElement("p");
    channel.className = "video-channel";
    channel.textContent = "Video4u";

    const meta = document.createElement("p");
    meta.className = "video-meta";

    const parts = [formatViews(video.views)];
    if (video.category) parts.push(video.category);

    const date = formatDate(video.createdAt);
    if (date) parts.push(date);

    meta.textContent = parts.join(" · ");

    text.append(title, channel, meta);
    details.append(avatar, text);
    link.append(thumbnail, details);

    return link;
  }

  function renderVideos() {
    const query = search.trim().toLocaleLowerCase("id");

    let filtered = videos.filter(video => {
      const matchesCategory =
        category === "Semua" ||
        String(video.category || "Lainnya").trim() === category;

      const searchableText =
        `${video.title || ""} ${video.description || ""} ${video.category || ""}`
          .toLocaleLowerCase("id");

      return matchesCategory && searchableText.includes(query);
    });

    if (mode === "Terbaru") {
      filtered.sort((a, b) =>
        String(b.createdAt || "").localeCompare(
          String(a.createdAt || "")
        )
      );
    } else if (mode === "Populer") {
      filtered.sort((a, b) =>
        (Number(b.views) || 0) - (Number(a.views) || 0)
      );
    }

    grid.replaceChildren();
    filtered.forEach(video => grid.append(videoCard(video)));

    if (count) {
      count.textContent = `${filtered.length} video`;
    }

    empty.classList.toggle("hidden", filtered.length > 0);
    grid.classList.toggle("hidden", filtered.length === 0);
  }

  document.getElementById("searchForm")?.addEventListener("submit", event => {
    event.preventDefault();
    search = searchInput?.value || "";
    renderVideos();
  });

  searchInput?.addEventListener("input", () => {
    search = searchInput.value;
    renderVideos();
  });

  document.getElementById("clearSearch")?.addEventListener("click", () => {
    search = "";
    category = "Semua";
    mode = "";

    if (searchInput) searchInput.value = "";

    renderCategories();
    renderVideos();
  });

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      mode = button.dataset.filter;
      category = "Semua";

      renderCategories();
      renderVideos();

      document.querySelectorAll("[data-filter]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      if (window.matchMedia("(max-width: 768px)").matches) {
        closeSidebar();
      }
    });
  });

  function closeSidebar() {
    sidebar?.classList.remove("open", "sidebar-open");
    document.body.classList.remove("sidebar-open");
    menuToggle?.setAttribute("aria-expanded", "false");
  }

  menuToggle?.addEventListener("click", () => {
    if (!sidebar) return;

    const isOpen = !sidebar.classList.contains("open");
    sidebar.classList.toggle("open", isOpen);
    sidebar.classList.remove("sidebar-open");
    document.body.classList.toggle("sidebar-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSidebar();
  });

  loadVideos();
})();
