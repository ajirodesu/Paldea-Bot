import axios from 'axios';

// --- Configuration ---
const TIMEOUT = 8000;
const API_URL = 'https://dummyjson.com/quotes/random';

// --- Helpers ---

const createKeyboard = (msgId) => ({
  inline_keyboard: [[
    { 
      text: '🔁 Inspire Me', 
      callback_data: JSON.stringify({ command: 'quote', id: msgId }) 
    }
  ]]
});

async function fetchQuote() {
  try {
    const { data } = await axios.get(API_URL, { 
      headers: { Accept: 'application/json' },
      timeout: TIMEOUT 
    });
    return data || null;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Quote Command
 * Fetches a random inspirational quote.
 */
export const meta = {
  name: 'quote',
  version: '1.1.0',
  aliases: ['inspire', 'motivation'],
  description: 'Get a random inspirational quote.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'random',
  type: 'anyone',
  cooldown: 5,
  guide: []
};

export async function onStart({ response }) {
  const loading = await response.reply('💭 **Seeking wisdom...**');

  try {
    const data = await fetchQuote();

    if (!data || !data.quote) {
      throw new Error('No quote received from API');
    }

    const message = `📜 **Quote of the Moment**\n\n_"${data.quote}"_\n\n— **${data.author}**`;

    await response.edit('text', loading, message, {
      reply_markup: createKeyboard(loading.message_id)
    });

  } catch (err) {
    // Fallback on error
    const fallbackMsg = `⚠️ **Network Error**\n\n_"Life is what happens when you're busy making other plans."_\n\n— **John Lennon**`;
    await response.edit('text', loading, fallbackMsg);
  }
}

export async function onCallback({ bot, callbackQuery, payload, response }) {
  const { message } = callbackQuery;

  // Validate Session
  if (!message || payload.id !== message.message_id) {
    return response.answerCallback(callbackQuery, { text: '⚠️ Session expired', show_alert: true });
  }

  try {
    await response.answerCallback(callbackQuery, { text: '💭 Thinking...' });

    const data = await fetchQuote();
    if (!data || !data.quote) throw new Error('Fetch failed');

    const messageText = `📜 **Quote of the Moment**\n\n_"${data.quote}"_\n\n— **${data.author}**`;

    await response.edit('text', message, messageText, {
      reply_markup: createKeyboard(message.message_id)
    });

  } catch (err) {
    await response.answerCallback(callbackQuery, { text: '⚠️ Failed to refresh', show_alert: true });
  }
}