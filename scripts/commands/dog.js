import axios from 'axios';

// --- Configuration ---
const TIMEOUT = 10000;
const API_URL = 'https://dog.ceo/api/breeds/image/random';

// --- Helpers ---

const createKeyboard = (msgId) => ({
  inline_keyboard: [[
    { 
      text: '🔁 Woof Again', 
      callback_data: JSON.stringify({ command: 'dog', id: msgId }) 
    }
  ]]
});

async function fetchDog() {
  try {
    const { data } = await axios.get(API_URL, { 
      headers: { Accept: 'application/json' },
      timeout: TIMEOUT 
    });
    return data?.message || null;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Dog Command
 * Fetches a random dog image.
 */
export const meta = {
  name: 'dog',
  version: '1.1.0',
  aliases: ['dogpic', 'dogimage', 'puppy'],
  description: 'Send a random dog image.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'random',
  type: 'anyone',
  cooldown: 5,
  guide: []
};

export async function onStart({ response }) {
  const loading = await response.reply('🐶 **Fetching a dog...**');

  try {
    const imageUrl = await fetchDog();

    if (!imageUrl) {
      return response.edit('text', loading, '⚠️ **Error:** Could not retrieve image.');
    }

    // Send Photo
    const sent = await response.upload('photo', imageUrl, {
      caption: '🐕 **Random Dog Image**',
      reply_markup: createKeyboard(0)
    });

    // Cleanup loader
    await response.delete(loading).catch(() => {});

    // Update markup with valid session ID
    if (sent?.message_id) {
      await response.edit('markup', sent, createKeyboard(sent.message_id));
    }

  } catch (err) {
    await response.edit('text', loading, `⚠️ **System Error:**\n\`${err.message}\``);
  }
}

export async function onCallback({ bot, callbackQuery, payload, response }) {
  const { message } = callbackQuery;

  // Validate Session
  if (!message || payload.id !== message.message_id) {
    return response.answerCallback(callbackQuery, { text: '⚠️ Session expired', show_alert: true });
  }

  try {
    await response.answerCallback(callbackQuery, { text: '🐶 Woof!' });

    const imageUrl = await fetchDog();
    if (!imageUrl) throw new Error('API returned empty data');

    // Refresh Media
    await response.edit('media', message, 
      { 
        type: 'photo', 
        media: imageUrl, 
        caption: '🐕 *Random Dog Image*' 
      },
      { reply_markup: createKeyboard(message.message_id) }
    );

  } catch (err) {
    await response.answerCallback(callbackQuery, { text: '⚠️ Failed to refresh.', show_alert: true });
  }
}