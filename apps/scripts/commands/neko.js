import axios from 'axios';

// --- Constants & Config ---
const CATEGORIES = [
  "waifu", "neko", "shinobu", "megumin", "bully", "cuddle", "cry", "hug", 
  "awoo", "kiss", "lick", "pat", "smug", "bonk", "yeet", "blush", "smile", 
  "wave", "highfive", "handhold", "nom", "bite", "glomp", "slap", "kill", 
  "kick", "happy", "wink", "poke", "dance", "cringe"
];

// Helper: Capitalize first letter
const toTitleCase = (str) => str.charAt(0).toUpperCase() + str.slice(1);

// Helper: Fetch Image
async function fetchWaifu(category) {
  try {
    const { data } = await axios.get(`https://api.waifu.pics/sfw/${category}`, { timeout: 10000 });
    return data?.url || null;
  } catch (err) {
    return null;
  }
}

// Helper: Create Keyboard
const createKeyboard = (category, msgId) => ({
  inline_keyboard: [[
    { 
      text: "🔁 Refresh", 
      callback_data: JSON.stringify({ command: "waifu", cat: category, id: msgId }) 
    }
  ]]
});

/**
 * Waifu Command
 * Fetches random anime-style images based on categories.
 */
export const meta = {
  name: "waifu",
  version: "1.2.0",
  aliases: ["waifupic", "waifuphoto"],
  description: "Get a random anime picture by category.",
  author: "ShawnDesu",
  category: "anime",
  type: "anyone",
  cooldown: 5,
  guide: ["[category]", "list"],
  prefix: "both",
};

export async function onStart({ args, response, usage }) {
  const arg = (args[0] || "waifu").toLowerCase();

  // 1. Handle Category List
  if (["list", "help", "categories"].includes(arg)) {
    const list = CATEGORIES.map(c => `\`${c}\``).join(", ");
    return response.reply(`📂 **Available Categories:**\n\n${list}`);
  }

  // 2. Validate Category
  if (!CATEGORIES.includes(arg)) {
    return response.reply(`⚠️ **Invalid Category**\nCategory \`${arg}\` does not exist.\nUse \`/waifu list\` to see options.`);
  }

  // 3. Execution
  const loading = await response.reply(`🔍 **Fetching ${arg}...**`);

  try {
    const url = await fetchWaifu(arg);
    if (!url) throw new Error("API returned no image.");

    // Send Photo using standard upload wrapper
    const sent = await response.upload('photo', url, {
      caption: `✨ **${toTitleCase(arg)}**`,
      reply_markup: createKeyboard(arg, 0)
    });

    // Cleanup loader
    await response.delete(loading).catch(() => {});

    // Update markup with message ID for session handling
    if (sent?.message_id) {
      await response.edit('markup', sent, createKeyboard(arg, sent.message_id));
    }

  } catch (err) {
    console.error('[Waifu] Error:', err.message);
    await response.edit('text', loading, `⚠️ **Error:** Failed to fetch image.`);
  }
}

export async function onCallback({ bot, callbackQuery, payload, response }) {
  const { message } = callbackQuery;

  // Basic Session Validation
  if (!message || payload.id !== message.message_id) {
    return response.answerCallback(callbackQuery, { text: "⚠️ Session expired", show_alert: true });
  }

  const category = payload.cat || "waifu";

  try {
    await response.answerCallback(callbackQuery, { text: "🔄 Loading..." });

    const url = await fetchWaifu(category);
    if (!url) throw new Error("No image found");

    await response.edit('media', message, 
      { 
        type: 'photo', 
        media: url, 
        caption: `✨ **${toTitleCase(category)}**` 
      },
      { reply_markup: createKeyboard(category, message.message_id) }
    );

  } catch (err) {
    await response.answerCallback(callbackQuery, { text: "⚠️ Failed to refresh", show_alert: true });
  }
}