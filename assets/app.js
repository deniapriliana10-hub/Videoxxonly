
(() => {
  "use strict";

  const config = window.VIDEOKU_CONFIG || {};
  const apiBase = String(config.API_BASE_URL || "")
    .replace(/\/+$/, "");

  const $ = (id) => document.getElementById(id);

  const grid = $("videoGrid");
  const count = $("videoCount");
  const chips = $("categoryChips");
  const empty = $("emptyState");
  const searchForm = $("searchForm");
  const searchInput = $("searchInput");
  const clearSearch = $("clearSearch");
  const menuToggle = $("menuToggle");
  const sidebar = $("sidebar");

  if (!grid) return;

  let videos = [];
  let activeCategory = "Semua";
  let search = "";
  let activeFilter = "Terbaru";

  async function loadVideos() {
    grid.innerHTML = '<div class="loading-state">Memuat video…</div>';

    try {
      const url = apiBase
        ? `${apiBase}/videos`
        : "data/videos.json";

      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Server merespons HTTP ${response.status}`);
      }

      const data = await response.json();

      videos = Array.isArray(data)
        ? data
        : Array.isArray(data.videos)
          ? data.videos
          : [];

      renderCategories();
      renderVideos();
    } catch (error) {
      console.error("VideoKu:", error);

      grid.innerHTML = `
        <div class="error-state">
          <p>Video gagal dimuat.</p>
          <p>${escapeHtml(error.message || "Periksa koneksi API.")}</p>
          <button type="button" id="retryVideos">Coba lagi</button>
        </div>
      `;

      if (count) count.textContent = "";
      if (empty) empty.classList.add("hidden");

      $("retryVideos")?.addEventListener("click", loadVideos);
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function renderCategories() {
    if (!chips) return;

    const categories = [
      "Semua",
      ...new Set(
        videos.map((video) => String(video.category || "Lainnya").trim())
          .filter(Boolean)
      )
    ];

    chips.replaceChildren();

    categories.forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "chip" + (category === activeCategory ? " selected" : "");
      button.textContent = category;

      button.addEventListener("click", () => {
        activeCategory = category;
        renderCategories();
        renderVideos();
      });

      chips.appendChild(button);
    });
  }

  function renderVideos() {
    const query = search.trim().toLowerCase();

    let filtered = videos.filter((video) => {
      const category = String(video.category || "Lainnya").trim();
      const matchesCategory =
        activeCategory === "Semua" || category === activeCategory;

      const text = [
        video.title,
        video.description,
        video.category
      ].join(" ").toLowerCase();

      return matchesCategory && text.includes(query);
    });

    if (activeFilter === "Terbaru") {
      filtered.sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );
    } else if (activeFilter === "Terlama") {
      filtered.sort((a, b) =>
        String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
      );
    } else if (activeFilter === "Populer") {
      filtered.sort((a, b) =>
        Number(b.views || 0) - Number(a.views || 0)
      );
    }

    grid.replaceChildren();

    filtered.forEach((video) => {
      const card = document.createElement("a");
      card.className = "video-card";
      card.href = `watch.html?id=${encodeURIComponent(video.id || "")}`;

      const thumb = document.createElement("div");
      thumb.className = "thumbnail-wrap";

      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = video.title || "Thumbnail video";
      img.src = video.thumbnail || "";
      img.onerror = () => {
        img.onerror = null;
        img.src = "https://placehold.co/640x360/272727/ffffff?text=VideoKu";
      };

      thumb.appendChild(img);

      const details = document.createElement("div");
      details.className = "video-card-details";

      const title = document.createElement("h3");
      title.className = "video-card-title";
      title.textContent = video.title || "Tanpa judul";

      const meta = document.createElement("p");
      meta.className = "video-meta";
      meta.textContent =
        `${video.category || "Lainnya"} · ${Number(video.views || 0)} tayangan`;

      details.append(title, meta);
      card.append(thumb, details);
      grid.appendChild(card);
    });

    if (count) count.textContent = `${filtered.length} video`;
    if (empty) empty.classList.toggle("hidden", filtered.length > 0);

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-message">Belum ada video yang cocok.</div>';
    }
  }

  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    search = searchInput?.value || "";
    renderVideos();
  });

  searchInput?.addEventListener("input", () => {
    search = searchInput.value || "";
    renderVideos();
  });

  clearSearch?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    search = "";
    activeCategory = "Semua";
    renderCategories();
    renderVideos();
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter || "Terbaru";
      renderVideos();
    });
  });

  menuToggle?.addEventListener("click", () => {
    if (sidebar) sidebar.classList.toggle("open");
  });

  sidebar?.querySelectorAll("a, button").forEach((item) => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.remove("open");
      }
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      sidebar?.classList.remove("open");
    }
  });

  loadVideos();
  window.dispatchEvent(new Event("videoku-app-started"));
})();
