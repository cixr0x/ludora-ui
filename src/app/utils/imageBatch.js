const imagePreloadCache = new Map();

function createBrowserImage() {
  return new Image();
}

export function preloadImage(src, createImage = createBrowserImage) {
  const normalizedSrc = typeof src === "string" ? src.trim() : "";
  if (!normalizedSrc) return Promise.resolve();

  const cached = imagePreloadCache.get(normalizedSrc);
  if (cached) return cached;

  if (typeof Image === "undefined" && createImage === createBrowserImage) {
    return Promise.resolve();
  }

  const promise = new Promise((resolve) => {
    let image;

    try {
      image = createImage();
    } catch {
      resolve();
      return;
    }

    const finish = () => resolve();
    const finishAfterDecode = () => {
      if (typeof image.decode !== "function") {
        finish();
        return;
      }

      image.decode().then(finish, finish);
    };

    image.onload = finishAfterDecode;
    image.onerror = finish;

    if ("decoding" in image) {
      image.decoding = "async";
    }

    image.src = normalizedSrc;

    if (image.complete) {
      finishAfterDecode();
    }
  });

  imagePreloadCache.set(normalizedSrc, promise);
  return promise;
}

export function preloadImageBatch(sources, preload = preloadImage) {
  const uniqueSources = [
    ...new Set(
      sources
        .filter((src) => typeof src === "string")
        .map((src) => src.trim())
        .filter(Boolean),
    ),
  ];

  return Promise.allSettled(uniqueSources.map((src) => preload(src))).then(() => undefined);
}

export function preloadImageRow(sources, preload = preloadImage) {
  return preloadImageBatch(sources, preload);
}
