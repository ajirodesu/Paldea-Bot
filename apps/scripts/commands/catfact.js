import axios from 'axios';

// --- Configuration ---
const TIMEOUT = 10000;
const API_URL = 'https://catfact.ninja/fact';

// --- Helpers ---

const createKeyboard = (msgId) => ({
  inline_keyboard: [[
    { 
      text: '🔁 Random Fact', 
      callback_data: JSON.stringify({ command: 'catfact', id: msgId }) 
    }
  ]]
});

async function fetchFact() {
  try {
    const { data } = await axios.get(API_URL, { 
      headers: { Accept: 'application/json' },
      timeout: TIMEOUT 
    });
    return data?.fact || null;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Cat Fact Command
 * Fetches a random fact from catfact.ninja.
 */
export const meta = {
  name: 'catfact',
  version: '1.1.0',
  aliases: ['catfacts', 'meowfact'],
  description: 'Get a random interesting fact about cats.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'random',
  type: 'anyone',
  cooldown: 5,
  guide: []
};

export async function onStart({ response }) {
  const loading = await response.reply('🐾 **Fetching a cat fact...**');

  try {
    const fact = await fetchFact();

    if (!fact) {
      return response.edit('text', loading, '⚠️ **Error:** Could not retrieve a fact.');
    }

    const message = `✨ **Cat Fact:**\n\n_${fact}_`;

    await response.edit('text', loading, message, {
      reply_markup: createKeyboard(loading.message_id)
    });

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
    // Toast notification
    await response.answerCallback(callbackQuery, { text: '🐾 Fetching...' });

    const fact = await fetchFact();
    if (!fact) throw new Error('API returned empty data');

    const messageText = `✨ **Cat Fact:**\n\n_${fact}_`;

    await response.edit('text', message, messageText, {
      reply_markup: createKeyboard(message.message_id)
    });

  } catch (err) {
    await response.answerCallback(callbackQuery, { text: '⚠️ Failed to refresh.', show_alert: true });
  }
}