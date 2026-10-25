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

  if (!player || !title || !meta || !description || !related) return;

  const safeUrl = value => {
    try {
      const url = new URL(value, location.href);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  };

  const style = document.createElement("style");
  style.textContent = `
    .player-shell {
      position: relative;
      width: 100%;
      min-width: 0;
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      border-radius: 10px;
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
      color: #bbb;
      text-align: center;
    }
  `;
  document.head.appendChild(style);

  async function fetchVideoList() {
    const sources = [];

    if (apiBase) {
      sources.push(`${apiBase}/api/videos`);
    }

    sources.push(
      new URL("data/videos.json", document.baseURI).href
    );

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

    videos
      .filter(item => String(item.id) !== String(currentId))
      .slice(0, 8)
      .forEach(item => {
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

        const paragraph = document.createElement("p");
        paragraph.textContent = `VideoKu · ${item.category || "Lainnya"}`;

        box.append(heading, paragraph);
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

      document.title = `${video.title || "Video"} — VideoKu`;
      title.textContent = video.title || "Tanpa judul";

      meta.textContent =
        `${video.category || "Lainnya"} · ` +
        (video.createdAt
          ? new Date(video.createdAt).toLocaleDateString("id-ID")
          : "VideoKu");

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
          console.error(
            "Video gagal diputar:",
            src,
            videoElement.error
          );

          let errorBox = player.querySelector(".watch-error");

          if (!errorBox) {
            errorBox = document.createElement("p");
            errorBox.className = "watch-error";
            player.appendChild(errorBox);
          }

          errorBox.textContent =
            "Video gagal diputar. Periksa apakah URL CDN masih aktif dan file MP4 dapat diakses.";
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

  document.getElementById("menuToggle")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("sidebar-open");
  });

  run();
})();
