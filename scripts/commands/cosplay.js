import axios from 'axios';

/**
 * Helpers
 */
const fetchCosplayVideo = async () => {
  try {
    const repoUrl = 'https://github.com/ajirodesu/cosplay/tree/main/';
    const { data: html } = await axios.get(repoUrl, { timeout: 8000 });

    // Regex to find .mp4 files in GitHub file list
    const re = /href="\/ajirodesu\/cosplay\/blob\/main\/([^"]+\.mp4)"/g;
    const files = [];
    let m;
    while ((m = re.exec(html)) !== null) files.push(m[1]);

    if (!files.length) return null;
    const file = files[Math.floor(Math.random() * files.length)];
    return `https://raw.githubusercontent.com/ajirodesu/cosplay/main/${file}`;
  } catch (err) {
    console.error('Cosplay Fetch Error:', err.message);
    return null;
  }
};

const createKeyboard = (msgId) => ({
  inline_keyboard: [[
    { text: "🔁 Next Video", callback_data: JSON.stringify({ command: "cosplay", id: msgId }) }
  ]]
});

/**
 * Cosplay Command
 */
export const meta = {
  name: "cosplay",
  version: "1.1.0",
  aliases: [],
  description: "Get a random cosplay video from the archive.",
  author: "AjiroDesu",
  prefix: "both",
  category: "random",
  type: "vip",
  cooldown: 5,
  guide: [],
};

export async function onStart({ response }) {
  const loading = await response.reply('🔎 **Searching archives...**');

  try {
    const videoUrl = await fetchCosplayVideo();
    if (!videoUrl) throw new Error('No videos found.');

    const sent = await response.upload('video', videoUrl, {
      caption: "👗 **Random Cosplay**",
      reply_markup: createKeyboard(0)
    });

    response.delete(loading).catch(() => {});

    if (sent?.message_id) {
      await response.edit('markup', sent, createKeyboard(sent.message_id));
    }

  } catch (err) {
    await response.edit('text', loading, `⚠️ **Error:** ${err.message}`);
  }
}

export async function onCallback({ bot, callbackQuery, payload, response }) {
  const { message } = callbackQuery;

  if (!message || payload.id !== message.message_id) {
    return response.answerCallback(callbackQuery, { text: "Session Expired", show_alert: true });
  }

  try {
    await response.answerCallback(callbackQuery, { text: "🔄 Loading..." });

    const videoUrl = await fetchCosplayVideo();
    if (!videoUrl) throw new Error("No video found");

    await response.edit('media', message, 
      { type: "video", media: videoUrl, caption: "👗 **Random Cosplay**" },
      { reply_markup: createKeyboard(message.message_id) }
    );

  } catch (err) {
    await response.answerCallback(callbackQuery, { text: "⚠️ Failed to refresh", show_alert: true });
  }
}