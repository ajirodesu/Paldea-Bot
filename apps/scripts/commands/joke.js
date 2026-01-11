import axios from 'axios';

// --- Configuration ---
const TIMEOUT = 10000;
const API_URL = 'https://official-joke-api.appspot.com/random_joke';

// --- Helpers ---

/**
 * Creates the refresh button keyboard.
 * @param {number} msgId - The ID of the message to update.
 */
const createKeyboard = (msgId) => ({
  inline_keyboard: [[
    { 
      text: '🔄 Next Joke', 
      callback_data: JSON.stringify({ command: 'joke', id: msgId }) 
    }
  ]]
});

/**
 * Fetches a random joke from the API.
 * @returns {Promise<string|null>} The formatted joke or null on failure.
 */
async function fetchJoke() {
  try {
    const { data } = await axios.get(API_URL, { timeout: TIMEOUT });

    // Validate response structure
    if (!data || !data.setup || !data.punchline) {
      throw new Error('Invalid data structure received from API');
    }

    return `**${data.setup}**\n\n_${data.punchline}_`;
  } catch (err) {
    console.error('[Joke API] Error:', err.message);
    return null;
  }
}

/**
 * Joke Command
 * Delivers a random setup/punchline joke to the user.
 */
export const meta = {
  name: "joke",
  version: "1.2.0",
  aliases: ["telljoke", "haha", "funny"],
  description: "Get a random joke to lighten the mood.",
  author: "JokeBotDev",
  prefix: "both",
  category: "random",
  type: "anyone",
  cooldown: 3,
  guide: []
};

export async function onStart({ response }) {
  const loading = await response.reply('🎭 **Thinking of a joke...**');

  try {
    const jokeText = await fetchJoke();

    if (!jokeText) {
      return response.edit('text', loading, '⚠️ **Error:** I couldn\'t think of a joke right now.');
    }

    const message = `🤣 **Random Joke**\n\n${jokeText}`;

    await response.edit('text', loading, message, {
      reply_markup: createKeyboard(loading.message_id)
    });

  } catch (err) {
    await response.edit('text', loading, `⚠️ **System Error:** ${err.message}`);
  }
}

export async function onCallback({ bot, callbackQuery, payload, response }) {
  const { message } = callbackQuery;

  // 1. Session Validation
  if (!message || payload.id !== message.message_id) {
    return response.answerCallback(callbackQuery, { text: '⚠️ Session expired', show_alert: true });
  }

  try {
    // 2. Interaction Feedback
    await response.answerCallback(callbackQuery, { text: '🎭 Loading...' });

    // 3. Fetch New Data
    const jokeText = await fetchJoke();
    if (!jokeText) throw new Error('Fetch failed');

    const messageText = `🤣 **Random Joke**\n\n${jokeText}`;

    // 4. Update UI
    await response.edit('text', message, messageText, {
      reply_markup: createKeyboard(message.message_id)
    });

  } catch (err) {
    await response.answerCallback(callbackQuery, { text: '⚠️ Failed to refresh', show_alert: true });
  }
}