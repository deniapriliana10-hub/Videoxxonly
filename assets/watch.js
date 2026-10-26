
(() => {
  "use strict";

  const config = window.VIDEOKU_CONFIG || {};
  const apiBase = String(config.API_BASE_URL || "").replace(/\/+$/, "");
  const id = new URLSearchParams(location.search).get("id");

  const player = document.getElementById("playerShell");
  const title = document.getElementById("watchTitle");
  const meta = document.getElementById("watchMeta");
  const description = document.getElementById("watchDescription");
  const related = document.getElementById("relatedVideos");
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menuToggle");

  if (!player || !title || !meta || !description || !related) return;

  const safeUrl = value => {
    try {
      const url = new URL(value, location.href);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  };

  const formatViews = value => {
    const number = Number(value);
    const views = Number.isFinite(number) && number > 0
      ? Math.floor(number)
      : 0;

    return `${views.toLocaleString("id-ID")} views`;
  };

  const formatDate = value => {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const style = document.createElement("style");
  style.textContent = `
    .player-shell {
      position: relative;
      width: 100%;
      min-width: 0;
      min-height: 180px;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      border: 1px solid #282d39;
      border-radius: 14px;
      background: #000;
    }

    .player-shell .video-player {
      display: block;
      width: 100%;
      height: auto;
      max-height: 75vh;
      object-fit: contain;
      background: #000;
      margin: 0 auto;
    }

    .player-shell.is-portrait .video-player {
      width: auto;
      max-width: 100%;
      max-height: 75vh;
    }

    .player-shell:fullscreen,
    .player-shell:-webkit-full-screen {
      width: 100%;
      height: 100%;
      border-radius: 0;
      background: #000;
    }

    .player-shell:fullscreen .video-player,
    .player-shell:-webkit-full-screen .video-player {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .watch-error {
      padding: 20px;
      color: #b7bfce;
      text-align: center;
      overflow-wrap: anywhere;
    }

    .watch-stats {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
      color: #969eae;
      font-size: 13px;
    }

    .watch-stats .views-count {
      color: #80adff;
      font-weight: 650;
    }

    .watch-description {
      margin-top: 18px;
      padding: 17px;
      border: 1px solid #282d39;
      border-radius: 12px;
      background: #12151d;
      color: #c4cbd8;
      line-height: 1.8;
      overflow-wrap: anywhere;
    }

    .related-card {
      display: flex;
      gap: 12px;
      padding: 10px;
      border: 1px solid #282d39;
      border-radius: 12px;
      background: #12151d;
      color: inherit;
      text-decoration: none;
      transition: border-color .2s;
    }

    .related-card:hover {
      border-color: #4385ff;
    }

    .related-card img {
      display: block;
      flex-shrink: 0;
      width: 145px;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 8px;
      background: #202633;
    }

    .related-card h3 {
      margin: 2px 0 6px;
      color: #f4f6fb;
      font-size: 13px;
      line-height: 1.5;
    }

    .related-card p {
      margin: 0 0 5px;
      color: #969eae;
      font-size: 11px;
    }

    .related-card .related-views {
      color: #80adff;
    }

    @media (max-width: 600px) {
      .player-shell {
        min-height: 160px;
        border-radius: 10px;
      }

      .related-card {
        gap: 10px;
        padding: 8px;
      }

      .related-card img {
        width: 125px;
      }

      .watch-description {
        padding: 13px;
      }
    }
  `;
  document.head.appendChild(style);

  async function fetchVideoList() {
    const sources = [];

    if (apiBase) sources.push(`${apiBase}/api/videos`);

    sources.push(
      new URL("data/videos.json", document.baseURI).href
    );

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

        console.log("Daftar video dimuat dari:", source);
        return list;
      } catch (error) {
        lastError = error;
        console.warn("Gagal mengambil daftar video:", source, error);
      }
    }

    throw lastError || new Error("Sumber data video tidak tersedia");
  }

  function showRelated(videos, currentId) {
    related.replaceChildren();

    const others = videos
      .filter(item => String(item.id) !== String(currentId))
      .sort((a, b) =>
        (Number(b.views) || 0) - (Number(a.views) || 0)
      )
      .slice(0, 8);

    others.forEach(item => {
      const link = document.createElement("a");
      link.className = "related-card";
      link.href = `watch.html?id=${encodeURIComponent(item.id || "")}`;

      const image = document.createElement("img");
      image.loading = "lazy";
      image.alt = item.title || "Thumbnail video";
      image.src =
        safeUrl(item.thumbnail) || "assets/thumbnail-placeholder.svg";

      image.onerror = () => {
        image.onerror = null;
        image.src = "assets/thumbnail-placeholder.svg";
      };

      const box = document.createElement("div");

      const heading = document.createElement("h3");
      heading.textContent = item.title || "Tanpa judul";

      const category = document.createElement("p");
      category.textContent = item.category || "Lainnya";

      const views = document.createElement("p");
      views.className = "related-views";
      views.textContent = formatViews(item.views);

      box.append(heading, category, views);
      link.append(image, box);
      related.appendChild(link);
    });
  }

  async function run() {
    try {
      if (!id) {
        throw new Error("ID video tidak ditemukan di alamat halaman.");
      }

      const videos = await fetchVideoList();
      const video = videos.find(item => String(item.id) === String(id));

      if (!video) {
        title.textContent = "Video tidak ditemukan";
        meta.textContent = "";
        description.textContent =
          "Video tidak ditemukan di daftar data. Periksa ID video pada tautan.";
        player.textContent = "Video ini tidak tersedia.";
        showRelated(videos, "");
        return;
      }

      document.title = `${video.title || "Video"} — Video4u`;
      title.textContent = video.title || "Tanpa judul";

      meta.replaceChildren();

      const stats = document.createElement("div");
      stats.className = "watch-stats";

      const views = document.createElement("span");
      views.className = "views-count";
      views.textContent = formatViews(video.views);

      const separator = document.createElement("span");
      separator.textContent = "·";

      const category = document.createElement("span");
      category.textContent = video.category || "Lainnya";

      const dateText = formatDate(video.createdAt);
      stats.append(views, separator, category);

      if (dateText) {
        const dateSeparator = document.createElement("span");
        dateSeparator.textContent = "·";

        const date = document.createElement("span");
        date.textContent = dateText;

        stats.append(dateSeparator, date);
      }

      meta.appendChild(stats);

      description.classList.add("watch-description");
      description.textContent =
        video.description || "Tidak ada deskripsi untuk video ini.";

      const src = safeUrl(video.videoUrl);

      if (!src) {
        player.textContent =
          "URL video tidak valid. Gunakan alamat video HTTPS yang benar.";
      } else {
        const videoElement = document.createElement("video");
        videoElement.className = "video-player";
        videoElement.controls = true;
        videoElement.preload = "metadata";
        videoElement.playsInline = true;
        videoElement.setAttribute("playsinline", "");

        const poster = safeUrl(video.thumbnail);
        if (poster) videoElement.poster = poster;

        videoElement.src = src;

        videoElement.addEventListener("loadedmetadata", () => {
          player.classList.toggle(
            "is-portrait",
            videoElement.videoHeight > videoElement.videoWidth
          );
        });

        videoElement.addEventListener("error", () => {
          console.error("Video gagal diputar:", src, videoElement.error);

          let errorBox = player.querySelector(".watch-error");

          if (!errorBox) {
            errorBox = document.createElement("p");
            errorBox.className = "watch-error";
            player.appendChild(errorBox);
          }

          errorBox.textContent =
            "Video gagal diputar. Periksa apakah URL CDN masih aktif dan file video dapat diakses.";
        });

        player.replaceChildren(videoElement);
      }

      showRelated(videos, id);

    } catch (error) {
      console.error("VideoKu watch error:", error);

      title.textContent = "Tidak dapat memuat video";
      meta.textContent = "";
      description.textContent = error.message || "Terjadi kesalahan.";
      player.replaceChildren();

      const message = document.createElement("p");
      message.className = "watch-error";
      message.textContent =
        "Daftar video tidak dapat dimuat. Periksa koneksi API atau data/videos.json.";

      player.appendChild(message);
    }
  }

  document.getElementById("searchForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const query =
      document.getElementById("searchInput")?.value.trim() || "";

    location.href =
      `index.html${query ? `?q=${encodeURIComponent(query)}` : ""}`;
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

  run();
})();
