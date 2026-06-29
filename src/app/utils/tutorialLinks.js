export function youtubeIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.split("/").filter(Boolean)[0];
    if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v") ?? undefined;
  } catch {
    return undefined;
  }
  return undefined;
}

export function tiktokTutorialFromUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname.endsWith("tiktok.com")) return undefined;

    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const videoIndex = pathParts.indexOf("video");
    const id = videoIndex >= 0 ? pathParts[videoIndex + 1] : undefined;
    if (!id || !/^\d+$/.test(id)) return undefined;

    const user = pathParts.find((part) => part.startsWith("@"))?.slice(1);
    return { id, user };
  } catch {
    return undefined;
  }
}
