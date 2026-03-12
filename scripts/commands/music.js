// music.js
export const meta = {
  name: "music",
  aliases: ["play", "ytplay", "song"],
  version: "1.0.1",
  author: "AjiroDesu",
  description: "Searches YouTube and sends the audio",
  prefix: "both",
  guide: ["<search query> - search & send audio"],
  cooldown: 3,
  type: "anyone",
  category: "media"
};

/**
 * Try to use global fetch (Node 18+). If not available, attempt dynamic ESM import of node-fetch.
 * Throws an error if no fetch is available.
 */
async function safeFetch(url, opts = {}) {
  if (typeof fetch !== "undefined") {
    return fetch(url, opts);
  }
  try {
    // dynamic import supports ESM node-fetch (v3+), which exports a default fetch function
    const nf = await import("node-fetch");
    const fetchFn = nf?.default ?? nf;
    return fetchFn(url, opts);
  } catch (err) {
    throw new Error("No fetch available: install node-fetch (v3+) or run on Node 18+");
  }
}

export async function onStart({ bot, response, chatId, msg, args, usages }) {
  try {
    const query = Array.isArray(args) ? args.join(" ").trim() : String(args || "").trim();
    if (!query) {
      // If the framework provided a usages() helper, call it; otherwise, send a usage message.
      if (typeof usages === "function") return await usages();
      return await response.reply("Usage: `/music <song name or query>`\nExample: `/music Enchanted Taylor Swift`");
    }

    // Inform the user we're working
    await response.action("typing");

    // Defensive check: ensure api base is configured
    const delineBase = (global.paldea && global.paldea.api && global.paldea.api.deline) || null;
    if (!delineBase) {
      await response.reply(
        "Music API base URL is not configured (global.paldea.api.deline). Please check `./json/api.json` on the server."
      );
      return;
    }

    const apiUrl = `${delineBase.replace(/\/+$/,"")}/downloader/ytplay?q=${encodeURIComponent(query)}`;

    const res = await safeFetch(apiUrl, { method: "GET" });
    if (!res || !res.ok) {
      return await response.reply("Failed to reach downloader API. Try again later.");
    }

    const body = await res.json();

    if (!body || !body.status || !body.result) {
      const errMsg = (body && body.message) ? body.message : "No results found for your query.";
      return await response.reply(`Error: ${errMsg}`);
    }

    const result = body.result;
    const title = result.title || "Unknown title";
    const ytUrl = result.url || null;
    const thumbnail = result.thumbnail || null;
    const pick = result.pick || {};
    const dlink = result.dlink || null;

    const pickInfo = [];
    if (pick.quality) pickInfo.push(`quality: ${pick.quality}`);
    if (pick.size) pickInfo.push(`size: ${pick.size}`);
    if (pick.ext) pickInfo.push(`ext: ${pick.ext}`);
    const pickStr = pickInfo.length ? `(${pickInfo.join(" • ")})` : "";

    const caption = `*${escapeMarkdown(title)}*\n${pickStr}\n\nRequested by: ${escapeMarkdown(getUserName(msg.from))}`;

    // Build inline keyboard
    const inlineKeyboard = [];
    if (ytUrl) inlineKeyboard.push([{ text: "▶ YouTube", url: ytUrl }]);
    if (dlink) inlineKeyboard.push([{ text: "📥 Direct download", url: dlink }]);

    // Try sending as audio first (Telegram supports an HTTP URL). If it fails, fallback to document or link.
    try {
      if (!dlink) throw new Error("No direct audio link available");

      await response.upload(
        "audio",
        dlink,
        {
          caption,
          parse_mode: "Markdown",
          thumb: thumbnail || undefined,
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        }
      );
      return;
    } catch (sendAudioErr) {
      // Fallback: send as document (Telegram may still reject some remote URLs depending on host)
      try {
        if (!dlink && ytUrl) {
          // If there's no dlink but we have a ytUrl, just send the metadata + link
          const fallbackMsg = `${caption}\n\nYouTube link: ${ytUrl}\n\nUnable to send audio directly.`;
          return await response.reply(fallbackMsg);
        }

        await response.upload(
          "document",
          dlink || ytUrl,
          {
            caption: caption + "\n\n_sent as document (audio fallback)_",
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: inlineKeyboard
            }
          }
        );
        return;
      } catch (sendDocErr) {
        // Final fallback: just send metadata + raw link(s)
        const fallbackMsg = `${caption}\n\nUnable to send file directly. You can download here:\n${dlink || ytUrl || "No link available"}`;
        return await response.reply(fallbackMsg, { parse_mode: "Markdown" });
      }
    }
  } catch (err) {
    console.error("music command error:", err);
    try {
      await response.reply("An unexpected error occurred while processing your request.");
    } catch (e) {
      // swallow
    }
  }
}

/**
 * Helpers
 */
function getUserName(from) {
  if (!from) return "unknown";
  let name = from.first_name || "";
  if (from.last_name) name += (name ? " " : "") + from.last_name;
  if (!name && from.username) name = "@" + from.username;
  return name || "user";
}

function escapeMarkdown(text = "") {
  // Minimal escape for Telegram "Markdown" parse_mode to avoid accidental markup issues.
  // This is conservative: only escape characters commonly used in Markdown.
  return String(text)
    .replace(/([_*`\[\]])/g, "\\$1");
}