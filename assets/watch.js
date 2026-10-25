
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
      const u = new URL(value);
      return u.protocol === "https:" ? u.href : "";
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

    .player-shell:fullscreen {
      width: 100%;
      height: 100%;
      max-width: none;
      max-height: none;
      border-radius: 0;
      background: #000;
    }

    .player-shell:fullscreen .video-player {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .player-shell:-webkit-full-screen {
      width: 100%;
      height: 100%;
      background: #000;
    }

    .player-shell:-webkit-full-screen .video-player {
      width: 100%;
      height: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  `;
  document.head.appendChild(style);

  async function run() {
    try {
      const response = await fetch(
        apiBase ? `${apiBase}/videos` : "data/videos.json",
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Gagal mengambil data video");
      }

      const data = await response.json();
      const videos = Array.isArray(data)
        ? data
        : Array.isArray(data.videos)
          ? data.videos
          : [];

      const video = videos.find((v) => String(v.id) === String(id));

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
        const v = document.createElement("video");

        v.className = "video-player";
        v.controls = true;
        v.preload = "metadata";
        v.playsInline = true;
        v.setAttribute("playsinline", "");
        v.setAttribute("webkit-playsinline", "");

        const poster = safeUrl(video.thumbnail);
        if (poster) v.poster = poster;

        v.src = src;

        v.addEventListener("loadedmetadata", () => {
          player.classList.toggle(
            "is-portrait",
            v.videoHeight > v.videoWidth
          );
        });

        v.addEventListener("error", () => {
          console.warn("Video gagal dimuat. Periksa URL atau format CDN.");
        });

        // Pemutar hanya berisi video; tombol biru tambahan dihapus.
        player.replaceChildren(v);
      }

      related.replaceChildren();

      videos
        .filter((v) => String(v.id) !== String(id))
        .slice(0, 8)
        .forEach((v) => {
          const a = document.createElement("a");
          a.className = "related-card";
          a.href = `watch.html?id=${encodeURIComponent(v.id || "")}`;

          const img = document.createElement("img");
          img.loading = "lazy";
          img.alt = "";
          img.src = safeUrl(v.thumbnail) || "assets/thumbnail-placeholder.svg";
          img.onerror = () => {
            img.onerror = null;
            img.src = "assets/thumbnail-placeholder.svg";
          };

          const box = document.createElement("div");
          const h = document.createElement("h3");
          h.textContent = v.title || "Tanpa judul";

          const p = document.createElement("p");
          p.textContent = `VideoKu · ${v.category || "Lainnya"}`;

          box.append(h, p);
          a.append(img, box);
          related.appendChild(a);
        });
    } catch (error) {
      console.error(error);
      title.textContent = "Tidak dapat memuat video";
      player.textContent = "Periksa koneksi API dan konfigurasi website.";
    }
  }

  document.getElementById("searchForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("searchInput")?.value.trim() || "";
    location.href = `index.html${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  });

  document.getElementById("menuToggle")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("sidebar-open");
  });

  run();
})();
