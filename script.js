const BACKEND_BASE_URL = "https://emeltv-backend.vercel.app";
const video = document.getElementById("video");
const playPauseBtn = document.getElementById("playPauseBtn");
const startOverlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startBtn");
const controls = document.querySelector(".controls");

const pauseText = "|| Pause";
const playText = "▶ Play";

let hls;

startBtn.addEventListener("click", () => {
  startStream();
  startOverlay.style.display = "none";
});

function setupControls() {
  video.pause();
  video.play();
  controls.classList.remove("show");
  playPauseBtn.textContent = pauseText;
}

// WebOS Media Key Handler
document.addEventListener("keydown", function (event) {
  console.log("Key pressed:", event.keyCode, event.key);

  switch (event.keyCode) {
    case 415: // Play button
    case 19: // Pause button
    case 404: // Green button
      event.preventDefault();
      refreshStream();
      break;

    case 32: // Space bar (backup)
      event.preventDefault();
      togglePlayPause();
      break;

    case 461: // Back button
      event.preventDefault();
      // Optional: možeš dodati funkcionalnost za Back dugme
      break;

    case 13: // OK/Enter
      event.preventDefault();
      if (startOverlay.style.display !== "none") {
        startBtn.click();
      } else if (controls.classList.contains("show")) {
        togglePlayPause();
      } else {
        showControlsTemporarily();
      }
      break;
  }
});

function togglePlayPause() {
  if (!video.src && !hls) return;

  console.log("Video is playing:", !video.paused);

  if (video.paused) {
    video.play();
    console.log("Playing via remote");
  } else {
    video.pause();
    console.log("Paused via remote");
  }

  showControlsTemporarily();
}

playPauseBtn.addEventListener("click", togglePlayPause);

if (typeof webOSSystem !== "undefined") {
  try {
    webOSSystem.keyboard.isShowing = false;
  } catch (e) {
    console.log("webOSSystem not available:", e);
  }
}

let controlsTimeout;

function showControlsTemporarily() {
  controls.classList.add("show");
  playPauseBtn.textContent = video.paused ? playText : pauseText;

  clearTimeout(controlsTimeout);
  controlsTimeout = setTimeout(() => {
    controls.classList.remove("show");
  }, 3000);
}

function startStream() {
  console.log("Getting client IP...");

  fetch("https://api.ipify.org?format=json")
    .then((res) => res.json())
    .then((ipData) => {
      const clientIp = ipData.ip;
      console.log("Client IP is:", clientIp);

      return fetch(`${BACKEND_BASE_URL}/stream-url?device=lg`, {
        headers: {
          "X-Client-IP": clientIp,
        },
      });
    })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Stream URL fetch failed: ${res.status} ${text}`);
      }
      console.log("Stream URL fetch successful:", res.status);
      return res.json();
    })
    .then((data) => {
      const hlsUrl = data.stream_url;
      console.log("Received stream URL:", hlsUrl);
      playStream(hlsUrl);
    })
    .catch((err) => {
      console.error("Error during stream start:", err);
      retryLater();
    });
}

function refreshStream() {
  console.log("Refreshing stream...");
  if (hls) {
    hls.destroy();
    hls = null;
  }
  video.pause();
  video.src = "";
  video.load();
  startStream(); // Ponovo pokreni stream koristeći novu logiku
}

function retryLater() {
  console.log("Retrying in 3 seconds…");
  setTimeout(startStream, 3000);
}

function playStream(hlsUrl) {
  if (hls) {
    hls.destroy();
    hls = null;
  }

  if (Hls.isSupported()) {
    hls = new Hls();
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.muted = false;
      video
        .play()
        .then(setupControls)
        .catch((err) => {
          console.error("Autoplay error:", err);
        });
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      console.error("HLS error event:", event);
      console.error("HLS error data:", data);

      if (data.details) {
        console.error("HLS error details:", data.details);
      }
      if (data.response) {
        console.error("HLS error response:", data.response);
      }

      if (data.fatal) {
        console.warn("Fatal HLS error. Attempting to refresh stream...");
        refreshStream();
      }
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = hlsUrl;

    video.addEventListener("loadedmetadata", () => {
      video.muted = false;
      video
        .play()
        .then(setupControls)
        .catch((err) => {
          console.error("Autoplay error:", err);
        });
    });

    video.addEventListener("error", (e) => {
      const error = video.error;
      console.error("Video element error event:", e);
      console.error("Video playback error:", error);

      refreshStream();
    });
  } else {
    console.error(
      "HLS is not supported and video element can't play HLS directly."
    );
  }
}

video.addEventListener("error", () => {
  console.error("Playback error detected, restarting stream.");
  refreshStream();
});
