import axios from 'axios';

// --- Configuration ---
const TIMEOUT = 15000;
const API_URL = 'https://api.popcat.xyz/v2/lyrics';

// --- Helpers ---

/**
 * Splits text into Telegram-safe chunks (~3000 chars to be safe).
 */
function chunkText(text, size = 3000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

/**
 * Lyrics Command
 * Fetches song lyrics via Popcat API.
 */
export const meta = {
  name: 'lyrics',
  version: '1.1.0',
  aliases: ['lyric', 'song'],
  description: 'Fetch song lyrics.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'media',
  type: 'anyone',
  cooldown: 5,
  guide: ['<song name>']
};

export async function onStart({ args, response, usage }) {
  if (!args.length) return usage();

  const songQuery = args.join(' ');
  const loading = await response.reply(`🎵 **Searching lyrics for:** _${songQuery}_...`);

  try {
    const { data } = await axios.get(API_URL, {
      params: { song: songQuery },
      timeout: TIMEOUT
    });

    // API Error Handling
    if (!data || data.error) {
      const errMsg = data.error || 'Song not found.';
      return response.edit('text', loading, `⚠️ **Error:** ${errMsg}`);
    }

    const { title, artist, lyrics, image } = data;

    if (!lyrics) {
      return response.edit('text', loading, '⚠️ **Not Found**\nLyrics not found for that song.');
    }

    // 1. Send Header (with image if available, else edit loading text)
    const header = `🎵 **${title}**\n👤 _${artist}_\n\n`;

    if (image) {
      await response.upload('photo', image, { caption: header });
      await response.delete(loading).catch(() => {});
    } else {
      await response.edit('text', loading, header);
    }

    // 2. Send Lyrics in Chunks (using Markdown code blocks)
    const chunks = chunkText(lyrics);

    for (const chunk of chunks) {
      await response.reply(`\`\`\`\n${chunk}\n\`\`\``);
    }

  } catch (err) {
    console.error('[Lyrics] Error:', err.message);
    await response.edit('text', loading, `⚠️ **System Error:**\n\`${err.message}\``);
  }
}