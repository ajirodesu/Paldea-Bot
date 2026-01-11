import axios from 'axios';

// --- Configuration ---
const API = {
  BASE: 'https://api.artic.edu/api/v1/artworks',
  IIIF: 'https://www.artic.edu/iiif/2'
};

// --- Helpers ---

/**
 * Fetches a random artwork from the Art Institute of Chicago.
 * Retries up to 5 times to find a valid image.
 */
async function fetchRandomArtwork() {
  try {
    // 1. Get total pages (cached estimate or fetch)
    // We cap at 5000 to ensure high quality/public domain hits usually found in earlier pages
    const maxPages = 4000; 

    for (let i = 0; i < 5; i++) {
      const page = Math.floor(Math.random() * maxPages) + 1;

      const { data } = await axios.get(API.BASE, {
        params: {
          page,
          limit: 1,
          fields: 'id,title,artist_display,date_display,image_id'
        },
        timeout: 8000
      });

      const art = data?.data?.[0];

      if (art && art.image_id) {
        return {
          title: art.title || 'Untitled',
          artist: art.artist_display || 'Unknown Artist',
          date: art.date_display || 'Unknown Date',
          imageUrl: `${API.IIIF}/${art.image_id}/full/843,/0/default.jpg`
        };
      }
    }
  } catch (err) {
    console.error('[Art API] Error:', err.message);
  }
  return null;
}

const createKeyboard = (msgId) => ({
  inline_keyboard: [[
    { 
      text: '🔁 Refresh', 
      callback_data: JSON.stringify({ command: 'art', id: msgId }) 
    }
  ]]
});

/**
 * Art Command
 * Displays random public domain artwork.
 */
export const meta = {
  name: 'art',
  version: '1.1.0',
  aliases: ['arts', 'artwork', 'museum'],
  description: 'View a random artwork from the Art Institute of Chicago.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'random',
  type: 'anyone',
  cooldown: 5,
  guide: []
};

export async function onStart({ response }) {
  const loading = await response.reply('🎨 **Visiting the museum...**');

  try {
    const art = await fetchRandomArtwork();

    if (!art) {
      return response.edit('text', loading, '⚠️ **No artwork found.**\nThe museum might be closed. Try again later.');
    }

    const caption = `🖼️ **${art.title}**\n` +
                    `👤 ${art.artist}\n` +
                    `📅 ${art.date}`;

    // Send Photo
    const sent = await response.upload('photo', art.imageUrl, {
      caption,
      reply_markup: createKeyboard(0) // Initial markup
    });

    // Cleanup loader
    await response.delete(loading).catch(() => {});

    // Update markup with valid session ID
    if (sent?.message_id) {
      await response.edit('markup', sent, createKeyboard(sent.message_id));
    }

  } catch (err) {
    await response.edit('text', loading, `⚠️ **Error:** ${err.message}`);
  }
}

export async function onCallback({ bot, callbackQuery, payload, response }) {
  const { message } = callbackQuery;

  // Session Validation
  if (!message || payload.id !== message.message_id) {
    return response.answerCallback(callbackQuery, { text: '⚠️ Session expired', show_alert: true });
  }

  try {
    await response.answerCallback(callbackQuery, { text: '🎨 Curating new piece...' });

    const art = await fetchRandomArtwork();
    if (!art) throw new Error('Failed to fetch artwork');

    const caption = `🖼️ **${art.title}**\n` +
                    `👤 ${art.artist}\n` +
                    `📅 ${art.date}`;

    await response.edit('media', message, 
      { 
        type: 'photo', 
        media: art.imageUrl, 
        caption 
      },
      { reply_markup: createKeyboard(message.message_id) }
    );

  } catch (err) {
    await response.answerCallback(callbackQuery, { text: '⚠️ Failed to refresh', show_alert: true });
  }
}