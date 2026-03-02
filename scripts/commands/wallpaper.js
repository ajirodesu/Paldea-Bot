import axios from 'axios';

// --- Configuration ---
const TIMEOUT = 20000;

// --- Helpers ---

/**
 * Parses arguments to extract dimensions (WxH) and search query.
 * Defaults to 1920x1080 if no size is specified.
 */
function parseArgs(args = []) {
  let width = 1920;
  let height = 1080;
  const parts = [...args];

  // Check last argument for dimensions (e.g., 2560x1440)
  const lastArg = parts[parts.length - 1] || "";
  const match = /^(\d{3,4})x(\d{3,4})$/i.exec(lastArg);

  if (match) {
    width = Math.min(3840, parseInt(match[1], 10)); // Cap at 4K
    height = Math.min(2160, parseInt(match[2], 10));
    parts.pop(); // Remove size from query
  }

  const query = parts.join(" ").trim();
  return { query, width, height };
}

/**
 * Wallpaper Command
 * Fetches high-quality wallpapers based on keywords or random generation.
 */
export const meta = {
  name: "wallpaper",
  version: "1.1.0",
  aliases: ["wp", "wall", "background"],
  description: "Get a random wallpaper (optionally specify size/topic).",
  author: "AjiroDesu",
  prefix: "both",
  category: "utility",
  type: "anyone",
  cooldown: 5,
  guide: ["[query] [WxH]"]
};

export async function onStart({ args, response, usage }) {
  const { query, width, height } = parseArgs(args);

  const loading = await response.reply(`🖼️ **Finding wallpaper...**\n🔎 Query: _${query || 'Random'}_ (${width}x${height})`);

  try {
    // 1. Determine Source
    // LoremFlickr is good for keywords, Picsum is great for abstract/random
    let url;
    let sourceName;

    if (query) {
      url = `https://loremflickr.com/${width}/${height}/${encodeURIComponent(query)}/all`;
      sourceName = "LoremFlickr";
    } else {
      url = `https://picsum.photos/${width}/${height}`;
      sourceName = "Picsum";
    }

    // 2. Fetch Image (Buffer)
    // We download the stream to ensure Telegram doesn't reject the redirect URL
    const { data } = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: TIMEOUT,
      maxRedirects: 5
    });

    const caption = 
      `🖼️ **Wallpaper Generated**\n` +
      `📐 **Size:** ${width}x${height}\n` +
      `🔎 **Topic:** ${query || 'Random'}\n` +
      `📷 **Source:** ${sourceName}`;

    // 3. Send Photo
    await response.upload('photo', data, {
      caption,
      filename: `wallpaper_${width}x${height}.jpg`
    });

    // 4. Cleanup
    await response.delete(loading).catch(() => {});

  } catch (err) {
    console.error('[Wallpaper] Error:', err.message);

    // Try to construct a friendly error message
    let errorMsg = `⚠️ **Generation Failed**\n\`${err.message}\``;

    if (err.response?.status === 404) {
      errorMsg = `⚠️ **Not Found**\nCould not find a wallpaper for "_${query}_". Try a simpler term.`;
    }

    await response.edit('text', loading, errorMsg);
  }
}