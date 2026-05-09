const scene = document.querySelector(".scene");
const hotspotLeft = document.getElementById("hotspot-left");
const buttonVideo = document.getElementById("button-video");
let primePromise = null;

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

async function prepareVideo() {
  if (buttonVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await waitForEvent(buttonVideo, "loadeddata");
  }

  if (buttonVideo.currentTime !== 0) {
    await new Promise((resolve) => {
      const handleSeeked = () => {
        resolve();
      };

      buttonVideo.addEventListener("seeked", handleSeeked, { once: true });
      buttonVideo.currentTime = 0;
    });
  }

  buttonVideo.pause();
}

function primeVideo() {
  if (!primePromise) {
    primePromise = prepareVideo().finally(() => {
      primePromise = null;
    });
  }

  return primePromise;
}

function resetScene() {
  buttonVideo.pause();
  scene.classList.remove("is-playing");
  hotspotLeft.disabled = false;
  void primeVideo();
}

async function playPressedAnimation() {
  if (scene.classList.contains("is-playing")) {
    return;
  }

  hotspotLeft.disabled = true;

  try {
    await primeVideo();
    scene.classList.add("is-playing");

    const playPromise = buttonVideo.play();

    if (playPromise instanceof Promise) {
      await playPromise;
    }
  } catch {
    resetScene();
  }
}

hotspotLeft.addEventListener("click", playPressedAnimation);
buttonVideo.addEventListener("ended", resetScene);
buttonVideo.addEventListener("error", resetScene);
buttonVideo.load();
void primeVideo();
