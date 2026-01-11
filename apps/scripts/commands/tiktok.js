import axios from 'axios';

// --- Configuration ---
const TIMEOUT = 20000;
const API_URL = 'https://tikwm.com/api/';

// --- Helpers ---

/**
 * Validates if the string is a valid TikTok URL.
 */
function isTikTokUrl(url) {
  return /tiktok\.com/i.test(url);
}

/**
 * TikTok Downloader Command
 * Downloads TikTok videos without watermark using TikWM.
 */
export const meta = {
  name: 'tiktok',
  version: '1.1.0',
  aliases: ['tikdl', 'tt', 'tiktokdl'],
  description: 'Download TikTok videos without watermark.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'downloader',
  type: 'anyone',
  cooldown: 10,
  guide: ['<url>']
};

export async function onStart({ args, response, usage }) {
  const url = args[0];

  // 1. Validation
  if (!url) return usage();

  if (!isTikTokUrl(url)) {
    return response.reply('⚠️ **Invalid URL**\nPlease provide a valid TikTok link.');
  }

  const loading = await response.reply('🎵 **Fetching TikTok video...**');

  try {
    // 2. Fetch Data
    const { data } = await axios.get(API_URL, {
      params: { url: url },
      timeout: TIMEOUT
    });

    // 3. API Validation
    if (!data || data.code !== 0 || !data.data) {
      const errorMsg = data?.msg || 'Video not found or private.';
      return response.edit('text', loading, `⚠️ **Download Failed:** ${errorMsg}`);
    }

    const video = data.data;
    const stats = `▶️ ${video.play_count} | ❤️ ${video.digg_count} | 💬 ${video.comment_count}`;

    const caption = 
      `🎬 **TikTok Downloader**\n\n` +
      `📌 **Title:** ${video.title || 'No Title'}\n` +
      `👤 **Author:** ${video.author.nickname} (@${video.author.unique_id})\n` +
      `⏱️ **Duration:** ${video.duration}s\n` +
      `📊 **Stats:** ${stats}\n\n` +
      `🔗 [Music](${video.music})`;

    // 4. Send Video
    // Passing the URL directly allows Telegram to download it
    await response.upload('video', video.play, {
      caption,
      thumb: video.cover, // Optional: Passing cover image as thumbnail
      width: video.width,
      height: video.height
    });

    // 5. Cleanup
    await response.delete(loading).catch(() => {});

  } catch (err) {
    console.error('[TikTok] Error:', err.message);
    await response.edit('text', loading, `⚠️ **System Error:**\n\`${err.message}\``);
  }
}