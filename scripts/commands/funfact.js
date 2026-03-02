import axios from 'axios';

// --- Configuration ---
const TIMEOUT = 8000;
const API_URL = 'https://uselessfacts.jsph.pl/random.json?language=en';

// --- Helpers ---

const createKeyboard = (msgId) => ({
  inline_keyboard: [[
    { 
      text: '🔁 Next Fact', 
      callback_data: JSON.stringify({ command: 'funfact', id: msgId }) 
    }
  ]]
});

async function fetchFact() {
  try {
    const { data } = await axios.get(API_URL, { timeout: TIMEOUT });
    return data?.text || null;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Fun Fact Command
 * Fetches a random useless fact.
 */
export const meta = {
  name: "funfact",
  version: "1.1.0",
  aliases: ["fact", "randomfact"],
  description: "Get a random fun fact to brighten your day.",
  author: "FunFactBotDev",
  prefix: "both",
  category: "random",
  type: "anyone",
  cooldown: 5,
  guide: []
};

export async function onStart({ response }) {
  const loading = await response.reply('🧠 **Fetching a fun fact...**');

  try {
    const fact = await fetchFact();
    if (!fact) throw new Error('No data received');

    const message = `💡 **Did you know?**\n\n_${fact}_`;

    await response.edit('text', loading, message, {
      reply_markup: createKeyboard(loading.message_id)
    });

  } catch (err) {
    await response.edit('text', loading, `⚠️ **Error:** ${err.message}`);
  }
}

export async function onCallback({ bot, callbackQuery, payload, response }) {
  const { message } = callbackQuery;

  // Validate Session
  if (!message || payload.id !== message.message_id) {
    return response.answerCallback(callbackQuery, { text: '⚠️ Session expired', show_alert: true });
  }

  try {
    await response.answerCallback(callbackQuery, { text: '💡 Thinking...' });

    const fact = await fetchFact();
    if (!fact) throw new Error('Fetch failed');

    const messageText = `💡 **Did you know?**\n\n_${fact}_`;

    await response.edit('text', message, messageText, {
      reply_markup: createKeyboard(message.message_id)
    });

  } catch (err) {
    await response.answerCallback(callbackQuery, { text: '⚠️ Failed to refresh', show_alert: true });
  }
}