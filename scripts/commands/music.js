/**
 * music.js
 * Music downloader command using NexRay API (YouTube + Spotify support)
 * 
 * Usage examples (for meta.guide):
 *   Nobela
 *   yt Sundo
 *   spotify Nobela
 */

export const meta = {
  name: "music",
  aliases: ["song", "play"],
  version: "1.0.2",
  author: "AjiroDesu",
  description: "Search and download music from YouTube or Spotify (direct MP3).",
  prefix: "both",
  guide: [
    "Nobela",
    "yt Sundo",
    "spotify Nobela"
  ],
  cooldown: 8,
  type: "anyone",
  category: "music"
};

export async function onStart({ response, args, usage }) {
  // Use framework's usage() when no song is provided
  if (!args.length) {
    await usage();
    return;
  }

  // Parse type (yt/spotify) + query
  let type = "yt";
  let query = args.join(" ").trim();

  const firstArg = args[0].toLowerCase();
  if (["yt", "spotify"].includes(firstArg)) {
    type = firstArg;
    query = args.slice(1).join(" ").trim();
  }

  if (!query) {
    await response.reply("❌ Please provide a song name after the type.");
    return;
  }

  const apiUrl = `${global.paldea.api.nexray}/downloader/${type}play?q=${encodeURIComponent(query)}`;

  let searchingMsg = null;

  try {
    await response.action("upload_audio");

    searchingMsg = await response.reply(
      `🔍 Searching **${query}** on **${type.toUpperCase()}**...\n` +
      `⏳ Please wait while I fetch the MP3...`
    );

    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`API returned status ${res.status}`);

    const data = await res.json();

    if (!data.status || !data.result?.download_url) {
      await response.reply("❌ No results found or download link unavailable.");
      if (searchingMsg) await response.delete(searchingMsg);
      return;
    }

    const r = data.result;
    const performer = r.artist || r.channel || "Unknown Artist";

    const caption = `🎵 **${r.title}**\n` +
                    `👤 ${performer}\n` +
                    `⏱ ${r.duration}`;

    await response.upload("audio", r.download_url, {
      caption,
      title: r.title,
      performer,
    });

    // Clean up searching message
    if (searchingMsg) await response.delete(searchingMsg);

  } catch (error) {
    console.error("[Music Command Error]", error);
    await response.reply("⚠️ Failed to fetch music. The API may be down or rate-limited.");

    if (searchingMsg) {
      await response.delete(searchingMsg).catch(() => {});
    }
  }
}