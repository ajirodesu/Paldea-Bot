export const meta = {
  name: "shoti",
  aliases: ["shotiv2", "shoti"],
  version: "1.0.0",
  author: "ShawnDesu",
  description: "Sends a random Shoti (TikTok-style short video) from the API.",
  prefix: "both",
  guide: [""],
  cooldown: 8,
  type: "anyone",
  category: "fun"
};

export async function onStart({ bot, response, chatId, msg, args }) {
  // ==================== LOADING MESSAGE ====================
  const loading = await response.reply("⏳ Fetching a fresh Shoti for you... 🎥");

  try {
    const apiUrl = "https://betadash-shoti-yazky.vercel.app/shotizxx?apikey=shipazu";
    const res = await fetch(apiUrl);

    if (!res.ok) throw new Error("API request failed");

    const data = await res.json();

    const {
      shotiurl,
      username,
      nickname,
      duration,
      region,
      cover_image
    } = data;

    if (!shotiurl) throw new Error("No video URL received");

    // Beautiful Markdown caption (your Response class will auto-convert ** to *)
    const caption = `🎥 **Random Shoti**\n\n` +
                    `👤 **Nickname**: ${nickname}\n` +
                    `📛 **Username**: @${username}\n` +
                    `⏱ **Duration**: ${duration} seconds\n` +
                    `🌍 **Region**: ${region}\n\n`+
                    `🔥 Enjoy Master! 💦`;

    // Send the video with auto-reply in groups + thumbnail
    await response.upload("video", shotiurl, {
      caption: caption,
      thumbnail: cover_image,        // uses the video cover as preview
      supports_streaming: true
    });

    // Clean up loading message (chat stays clean)
    await response.delete(loading);

  } catch (error) {
    console.error("Shoti error:", error);
    // Edit loading into error message instead of spamming
    await response.edit(
      "text",
      loading,
      "❌ Failed to fetch Shoti right now.\n\nTry again in a few seconds!"
    );
  }
}