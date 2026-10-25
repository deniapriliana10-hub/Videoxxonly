
(() => {
  "use strict";

  const config = window.VIDEOKU_CONFIG || {};
  const apiBase = String(config.API_BASE_URL || "").replace(/\/+$/, "");

  const grid = document.getElementById("videoGrid");
  const count = document.getElementById("videoCount");
  const chips = document.getElementById("categoryChips");
  const empty = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");

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
    if (!value) return "VideoKu";
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "VideoKu"
      : date.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric"
        });
  }

  async function loadVideos() {
    const sources = [];

    // Sumber API, jika dikonfigurasi.
    if (apiBase) {
      sources.push(`${apiBase}/api/videos`);
    }

    // Fallback ke file JSON pada website saat ini.
    sources.push(new URL("data/videos.json", document.baseURI).href);

    let lastError;

    for (const source of [...new Set(sources)]) {
      try {
        const response = await fetch(source, {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.videos)
            ? data.videos
            : null;

        if (!list) {
          throw new Error("Format data video tidak valid");
        }

        videos = list.filter(
          video => video && typeof video === "object"
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

    thumbnail.append(image, play);

    const details = document.createElement("div");
    details.className = "video-card-details";

    const avatar = document.createElement("div");
    avatar.className = "channel-avatar";
    avatar.textContent = "V";

    const text = document.createElement("div");
    text.className = "video-card-text";

    const title = document.createElement("h3");
    title.textContent = video.title || "Tanpa judul";

    const channel = document.createElement("p");
    channel.className = "video-channel";
    channel.textContent = "VideoKu";

    const meta = document.createElement("p");
    meta.className = "video-meta";
    meta.textContent =
      `${video.category || "Lainnya"} · ${formatDate(video.createdAt)}`;

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
    }

    grid.replaceChildren();
    filtered.forEach(video => grid.append(videoCard(video)));

    if (count) count.textContent = `${filtered.length} video`;

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
    });
  });

  document.getElementById("menuToggle")?.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    const toggle = document.getElementById("menuToggle");

    sidebar?.classList.toggle("sidebar-open");

    if (toggle) {
      toggle.setAttribute(
        "aria-expanded",
        String(sidebar?.classList.contains("sidebar-open") || false)
      );
    }
  });

  loadVideos();
})();
