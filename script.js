const backgroundImage = document.getElementById("background-image");
const hotspotButtons = Array.from(document.querySelectorAll(".hotspot[data-button]"));
const sceneCanvas = document.getElementById("scene-canvas");
const canvasContext = sceneCanvas.getContext("2d");
const sourceVideos = Array.from(document.querySelectorAll(".source-video[data-button]"));
const videoByButton = new Map(sourceVideos.map((video) => [video.dataset.button, video]));
const primePromises = new Map();
const backgroundSources = [
  "Assets/img/Background.png",
  "Assets/img/background.png",
];
let activeVideo = null;
let renderToken = 0;

canvasContext.imageSmoothingEnabled = true;

function ensureBackgroundImage() {
  let sourceIndex = backgroundSources.indexOf(backgroundImage.getAttribute("src") || "");

  if (sourceIndex < 0) {
    sourceIndex = 0;
    backgroundImage.src = backgroundSources[sourceIndex];
  }

  backgroundImage.addEventListener("error", () => {
    const nextSource = backgroundSources[sourceIndex + 1];

    if (!nextSource) {
      return;
    }

    sourceIndex += 1;
    backgroundImage.src = nextSource;
  });
}

function waitForEvent(target, eventName) {
  return new Promise((resolve, reject) => {
    const handleSuccess = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error(`Video event failed: ${eventName}`));
    };

    const cleanup = () => {
      target.removeEventListener(eventName, handleSuccess);
      target.removeEventListener("error", handleError);
    };

    target.addEventListener(eventName, handleSuccess, { once: true });
    target.addEventListener("error", handleError, { once: true });
  });
}

function seekVideoToStart(video) {
  if (Math.abs(video.currentTime) < 0.01) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const handleSeeked = () => {
      resolve();
    };

    video.addEventListener("seeked", handleSeeked, { once: true });
    video.currentTime = 0;
  });
}

async function prepareVideo(video) {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await waitForEvent(video, "loadeddata");
  }

  await seekVideoToStart(video);
  video.pause();
}

function primeVideo(video) {
  if (!primePromises.has(video)) {
    const primePromise = prepareVideo(video).finally(() => {
      primePromises.delete(video);
    });

    primePromises.set(video, primePromise);
  }

  return primePromises.get(video);
}

function clearCanvas() {
  canvasContext.clearRect(0, 0, sceneCanvas.width, sceneCanvas.height);
}

function drawVideoFrame(video) {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

  clearCanvas();
  canvasContext.drawImage(video, 0, 0, sceneCanvas.width, sceneCanvas.height);
}

function scheduleCanvasRender(video, token) {
  const drawNextFrame = () => {
    if (token !== renderToken || activeVideo !== video) {
      return;
    }

    drawVideoFrame(video);

    if (video.paused || video.ended) {
      return;
    }

    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(() => {
        drawNextFrame();
      });
      return;
    }

    requestAnimationFrame(drawNextFrame);
  };

  drawNextFrame();
}

function resetScene() {
  renderToken += 1;

  if (!activeVideo) {
    hotspotButtons.forEach((button) => {
      button.disabled = false;
    });
    sceneCanvas.classList.remove("is-active");
    clearCanvas();
    return;
  }

  const finishedVideo = activeVideo;
  activeVideo = null;

  finishedVideo.pause();
  sceneCanvas.classList.remove("is-active");
  clearCanvas();

  hotspotButtons.forEach((button) => {
    button.disabled = false;
  });

  void primeVideo(finishedVideo);
}

async function playPressedAnimation(event) {
  if (activeVideo) {
    return;
  }

  const selectedButton = event.currentTarget;
  const videoKey = selectedButton.dataset.button;
  const selectedVideo = videoByButton.get(videoKey);

  if (!selectedVideo) {
    return;
  }

  activeVideo = selectedVideo;
  renderToken += 1;
  const token = renderToken;

  hotspotButtons.forEach((button) => {
    button.disabled = true;
  });

  try {
    await primeVideo(selectedVideo);
    drawVideoFrame(selectedVideo);
    sceneCanvas.classList.add("is-active");

    const playPromise = selectedVideo.play();

    if (playPromise instanceof Promise) {
      await playPromise;
    }

    scheduleCanvasRender(selectedVideo, token);
  } catch {
    resetScene();
  }
}

hotspotButtons.forEach((button) => {
  button.addEventListener("click", playPressedAnimation);
});

ensureBackgroundImage();

sourceVideos.forEach((video) => {
  video.addEventListener("ended", resetScene);
  video.addEventListener("error", resetScene);
  video.load();
  void primeVideo(video);
});
