import axios from 'axios';

export const meta = {
  name: 'spotify',
  version: '1.2.0',
  aliases: ['sp', 'play'],
  description: 'Search and download tracks from Spotify.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'search',
  type: 'anyone',
  cooldown: 10,
  guide: ['<song title>'],
};

export async function onStart({ args, response, usage }) {
  if (!args.length) return usage();

  const query = args.join(' ');
  const loading = await response.reply(`🔎 **Searching Spotify for:** _${query}_...`);

  try {
    // 1. Fetch Metadata
    const { data } = await axios.get(`${global.paldea.api.nekolabs}/downloader/spotify/play/v1`, {
      params: { q: query },
      timeout: 15000
    });

    if (!data?.success || !data?.result) {
      throw new Error('Track not found or API unavailable.');
    }

    const { metadata, downloadUrl, downloadurl } = data.result;
    const url = downloadUrl || downloadurl;

    if (!url || url.includes('undefined')) {
      throw new Error('Invalid download URL returned by API.');
    }

    // 2. Stream Audio
    const audioStream = await axios.get(url, {
      responseType: 'stream',
      timeout: 60000
    });

    // 3. Prepare Metadata
    const caption = `🎵 **${metadata.title}**\n` +
                    `👤 **Artist:** ${metadata.artist}\n` +
                    `⏱️ **Duration:** ${metadata.duration}`;

    const options = {
      caption,
      parse_mode: 'Markdown',
      title: metadata.title, // For Telegram Audio Player
      performer: metadata.artist,
      reply_markup: {
        inline_keyboard: metadata.url ? [[{ text: '🔗 Open Spotify', url: metadata.url }]] : []
      }
    };

    // 4. Send
    await response.upload('audio', audioStream.data, options);
    await response.delete(loading);

  } catch (err) {
    console.error('Spotify Error:', err.message);
    await response.edit('text', loading, `⚠️ **Download Failed:** ${err.message}`);
  }
}