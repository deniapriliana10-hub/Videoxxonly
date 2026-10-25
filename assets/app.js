
/* =====================================
   VIDEO4U - APP.JS
   API, VIDEO GRID, SEARCH, CATEGORY
===================================== */

(() => {
  "use strict";

  const API_BASE =
    window.VIDEOKU_CONFIG?.API_BASE_URL ||
    "https://videoku-api.deniapriliana10.workers.dev";

  const API_URL = API_BASE.replace(/\/+$/, "") + "/videos";

  const $ = (id) => document.getElementById(id);

  const grid = $("videoGrid");
  const count = $("videoCount");
  const emptyState = $("emptyState");
  const searchForm = $("searchForm");
  const searchInput = $("searchInput");
  const clearSearch = $("clearSearch");
  const categoryChips = $("categoryChips");
  const sidebar = $("sidebar");
  const menuToggle = $("menuToggle");

  let allVideos = [];
  let activeCategory = "Semua";
  let searchQuery = "";
  let activeFilter = "Terbaru";

  // =========================
  // MENU SAMPING
  // =========================

  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle("open");
      } else {
        sidebar.classList.toggle("sidebar-collapsed");
      }
    });

    sidebar.querySelectorAll("a, button").forEach((item) => {
      item.addEventListener("click", () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove("open");
        }
      });
    });
  }

  // =========================
  // STYLE KARTU VIDEO
  // =========================

  const style = document.createElement("style");

  style.textContent = `
    .sidebar.sidebar-collapsed {
      transform: translateX(-100%);
    }

    .sidebar.sidebar-collapsed ~ .main-content {
      margin-left: 0;
      width: 100%;
    }

    .video-grid .video-card {
      min-width: 0;
      overflow: hidden;
      border-radius: 12px;
      background: #181818;
      border: 1px solid #292929;
    }

    .video-card .video-thumbnail {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      background: #272727;
    }

    .video-card .video-info {
      padding: 12px;
    }

    .video-card .video-title {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      margin: 0 0 9px;
      color: #f5f5f5;
      font-size: 15px;
      line-height: 1.45;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .video-card .video-meta {
      color: #aaa;
      font-size: 12px;
      line-height: 1.6;
    }

    .video-card .video-watch {
      display: block;
      color: inherit;
      text-decoration: none;
    }

    .video-card .video-watch:focus-visible {
      outline: 2px solid #ff3030;
      outline-offset: 3px;
    }

    .video-grid .loading-state,
    .video-grid .error-state {
      grid-column: 1 / -1;
      padding: 24px 8px;
      color: #aaa;
      text-align: center;
    }

    .video-grid .error-state button {
      margin-top: 12px;
      padding: 10px 16px;
      border: 0;
      border-radius: 8px;
      background: #ff3030;
      color: white;
      cursor: pointer;
    }

    @media (max-width: 768px) {
      .video-card .video-info {
        padding: 9px;
      }

      .video-card .video-title {
        font-size: 14px;
      }
    }
  `;

  document.head.appendChild(style);

  // =========================
  // HELPER
  // =========================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
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

  function safeURL(value) {
    try {
      const url = new URL(value, window.location.href);

      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.href;
      }
    } catch (_) {}

    return "";
  }

  function getThumbnail(video) {
    const thumb = safeURL(video.thumbnail);

    if (thumb) return thumb;

    return "https://placehold.co/640x360/272727/ffffff?text=VideoKu";
  }

  // =========================
  // BACA DATA API
  // =========================

  async function loadVideos() {
    if (!grid) return;

    grid.innerHTML =
      '<div class="loading-state">Memuat video...</div>';

    if (emptyState) emptyState.classList.add("hidden");

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          "Accept": "application/json"
        },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Server mengembalikan HTTP " + response.status);
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.videos)) {
        throw new Error("Format data API tidak sesuai.");
      }

      allVideos = data.videos.filter((video) => {
        return video && video.id && video.title && video.videoUrl;
      });

      createCategories();
      renderVideos();

    } catch (error) {
      console.error("VideoKu API error:", error);

      grid.innerHTML = `
        <div class="error-state">
          <p>Video gagal dimuat.</p>
          <p>Periksa koneksi internet atau server API.</p>
          <button type="button" id="retryVideos">Coba lagi</button>
        </div>
      `;

      if (count) count.textContent = "";

      if (emptyState) emptyState.classList.add("hidden");

      const retry = $("retryVideos");

      if (retry) {
        retry.addEventListener("click", loadVideos);
      }
    }
  }

  // =========================
  // BUAT TOMBOL KATEGORI
  // =========================

  function createCategories() {
    if (!categoryChips) return;

    const categories = [
      ...new Set(
        allVideos
          .map((video) => String(video.category || "").trim())
          .filter(Boolean)
      )
    ];

    categoryChips.innerHTML = "";

    ["Semua", ...categories].forEach((category) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className =
        "chip" + (category === activeCategory ? " selected" : "");

      button.dataset.category = category;
      button.textContent = category;

      button.addEventListener("click", () => {
        activeCategory = category;

        categoryChips.querySelectorAll(".chip").forEach((chip) => {
          chip.classList.toggle(
            "selected",
            chip.dataset.category === activeCategory
          );
        });

        renderVideos();
      });

      categoryChips.appendChild(button);
    });

    if (!categories.includes(activeCategory)) {
      activeCategory = "Semua";
    }

    categoryChips.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle(
        "selected",
        chip.dataset.category === activeCategory
      );
    });
  }

  // =========================
  // FILTER, PENCARIAN, SORTIR
  // =========================

  function getFilteredVideos() {
    let videos = [...allVideos];

    if (activeCategory !== "Semua") {
      videos = videos.filter(
        (video) => video.category === activeCategory
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();

      videos = videos.filter((video) => {
        const text = [
          video.title,
          video.description,
          video.category
        ].join(" ").toLowerCase();

        return text.includes(query);
      });
    }

    if (activeFilter === "Populer") {
      videos.sort(
        (a, b) => Number(b.views || 0) - Number(a.views || 0)
      );
    } else {
      videos.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );
    }

    return videos;
  }

  // =========================
  // TAMPILKAN KARTU VIDEO
  // =========================

  function renderVideos() {
    if (!grid) return;

    const videos = getFilteredVideos();

    if (count) {
      count.textContent = videos.length + " video";
    }

    grid.innerHTML = "";

    if (videos.length === 0) {
      if (emptyState) {
        emptyState.classList.remove("hidden");
      } else {
        grid.innerHTML =
          '<div class="loading-state">Video tidak ditemukan.</div>';
      }

      return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    const fragment = document.createDocumentFragment();

    videos.forEach((video) => {
      const card = document.createElement("article");
      card.className = "video-card";

      const watchURL = safeURL(video.videoUrl);
      const thumbnailURL = getThumbnail(video);
      const title = escapeHTML(video.title);
      const category = escapeHTML(video.category || "Video");
      const date = escapeHTML(formatDate(video.createdAt));
      const views = Number(video.views || 0);

      const isVideoThumbnail = /\.(mp4|webm|ogg)(\?.*)?$/i
        .test(thumbnailURL);

      let thumbnail;

      if (isVideoThumbnail) {
        thumbnail = `
          <video
            class="video-thumbnail"
            src="${escapeHTML(thumbnailURL)}"
            muted
            playsinline
            preload="none"
            aria-label="${title}"
          ></video>
        `;
      } else {
        thumbnail = `
          <img
            class="video-thumbnail"
            src="${escapeHTML(thumbnailURL)}"
            alt="${title}"
            loading="lazy"
            decoding="async"
            onerror="this.onerror=null;this.src='https://placehold.co/640x360/272727/ffffff?text=VideoKu';"
          >
        `;
      }

      card.innerHTML = `
        <a
          class="video-watch"
          ${watchURL
            ? `href="${escapeHTML(watchURL)}" target="_blank" rel="noopener noreferrer"`
            : ""}
          aria-label="Tonton ${title}"
        >
          ${thumbnail}
        </a>

        <div class="video-info">
          <h2 class="video-title">${title}</h2>
          <div class="video-meta">${category}</div>
          <div class="video-meta">
            ${views} tayangan${date ? " · " + date : ""}
          </div>
        </div>
      `;

      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
  }

  // =========================
  // PENCARIAN
  // =========================

  if (searchForm && searchInput) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      searchQuery = searchInput.value.trim();
      renderVideos();
    });

    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value.trim();
      renderVideos();
    });
  }

  if (clearSearch) {
    clearSearch.addEventListener("click", () => {
      searchQuery = "";
      activeCategory = "Semua";
      activeFilter = "Terbaru";

      if (searchInput) searchInput.value = "";

      createCategories();
      renderVideos();
    });
  }

  // =========================
  // MENU TERBARU / POPULER
  // =========================

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter === "Populer"
        ? "Populer"
        : "Terbaru";

      renderVideos();
    });
  });

  // =========================
  // MULAI
  // =========================

  loadVideos();

})();
      
