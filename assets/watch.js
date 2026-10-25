
(() => {
  "use strict";

  const config = window.VIDEOKU_CONFIG || { API_BASE_URL: "" };
  const apiBase = (config.API_BASE_URL || "").replace(/\/+$/, "");
  const id = new URLSearchParams(location.search).get("id");

  const player = document.getElementById("playerShell");
  const title = document.getElementById("watchTitle");
  const meta = document.getElementById("watchMeta");
  const description = document.getElementById("watchDescription");
  const related = document.getElementById("relatedVideos");

  if (!player || !title || !meta || !description || !related) return;

  const safeUrl = (value) => {
    try {
      const url = new URL(value);
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
      height: auto;
      max-width: 100%;
      max-height: 75vh;
      aspect-ratio: auto;
      object-fit: contain;
    }

    .player-shell:fullscreen,
    .player-shell:-webkit-full-screen {
      width: 100%;
      height: 100%;
      max-width: none;
      max-height: none;
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
  `;
  document.head.appendChild(style);

  async function run() {
    try {
      const url = apiBase
        ? `${apiBase}/api/videos`
        : "data/videos.json";

      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Gagal mengambil data video (${response.status})`);
      }

      const data = await response.json();
      const videos = Array.isArray(data)
        ? data
        : Array.isArray(data.videos)
          ? data.videos
          : [];

      const video = videos.find((item) => String(item.id) === String(id));

      if (!video) {
        title.textContent = "Video tidak ditemukan";
        player.textContent = "Video ini tidak tersedia atau tautannya salah.";
        meta.textContent = "";
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
          "URL video tidak valid. Admin harus menggunakan URL HTTPS.";
      } else {
        const videoElement = document.createElement("video");

        videoElement.className = "video-player";
        videoElement.controls = true;
        videoElement.preload = "metadata";
        videoElement.playsInline = true;
        videoElement.setAttribute("playsinline", "");
        videoElement.setAttribute("webkit-playsinline", "");

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
          console.warn("Video gagal dimuat. Periksa URL atau format CDN.");
        });

        // Tidak membuat tombol fullscreen tambahan.
        // Kontrol bawaan browser tetap aktif.
        player.replaceChildren(videoElement);
      }

      related.replaceChildren();

      videos
        .filter((item) => String(item.id) !== String(id))
        .slice(0, 8)
        .forEach((item) => {
          const link = document.createElement("a");
          link.className = "related-card";
          link.href = `watch.html?id=${encodeURIComponent(item.id || "")}`;

          const image = document.createElement("img");
          image.loading = "lazy";
          image.alt = "";
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
    } catch (error) {
      console.error("VideoKu watch error:", error);
      title.textContent = "Tidak dapat memuat video";
      player.textContent = "Periksa koneksi API dan konfigurasi website.";
    }
  }

  document.getElementById("searchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query =
      document.getElementById("searchInput")?.value.trim() || "";
    location.href = `index.html${query ? `?q=${encodeURIComponent(query)}` : ""}`;
  });

  document.getElementById("menuToggle")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("sidebar-open");
  });

  run();
})();
