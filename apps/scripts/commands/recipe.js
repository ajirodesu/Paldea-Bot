import axios from 'axios';

// --- Configuration ---
const TIMEOUT = 8000;
const API_URL = 'https://www.themealdb.com/api/json/v1/1/random.php';

// --- Helpers ---

const createKeyboard = (msgId) => ({
  inline_keyboard: [[
    { 
      text: '🔁 New Recipe', 
      callback_data: JSON.stringify({ command: 'recipe', id: msgId }) 
    }
  ]]
});

/**
 * Fetches a random recipe from TheMealDB.
 */
async function fetchRecipe() {
  try {
    const { data } = await axios.get(API_URL, { timeout: TIMEOUT });
    return data?.meals?.[0] || null;
  } catch (err) {
    console.error('[Recipe API] Error:', err.message);
    return null;
  }
}

/**
 * Formats the recipe data into a readable caption.
 * Truncates if too long for Telegram.
 */
function formatRecipe(meal) {
  const ingredients = [];

  // TheMealDB stores ingredients in separate keys (strIngredient1...20)
  for (let i = 1; i <= 20; i++) {
    const ing = (meal[`strIngredient${i}`] || '').trim();
    const measure = (meal[`strMeasure${i}`] || '').trim();

    if (ing) {
      ingredients.push(`- ${ing}${measure ? ` (${measure})` : ''}`);
    }
  }

  let caption = 
    `🍽️ **${meal.strMeal}**\n` +
    `📂 Category: ${meal.strCategory || 'Misc'}\n` +
    `🌎 Area: ${meal.strArea || 'Unknown'}\n\n` +
    `📝 **Instructions:**\n${meal.strInstructions || 'No instructions provided.'}\n\n` +
    `🥕 **Ingredients:**\n${ingredients.join('\n')}`;

  // Telegram Caption Limit is 1024 chars
  if (caption.length > 1020) {
    caption = caption.substring(0, 1015) + '...';
  }

  return caption;
}

/**
 * Recipe Command
 * Fetches a random meal recipe with instructions and ingredients.
 */
export const meta = {
  name: 'recipe',
  version: '1.2.0',
  aliases: ['meal', 'food', 'cook'],
  description: 'Get a random recipe suggestion.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'random',
  type: 'anyone',
  cooldown: 5,
  guide: []
};

export async function onStart({ response }) {
  const loading = await response.reply('🍳 **Firing up the stove...**');

  try {
    const meal = await fetchRecipe();

    if (!meal) {
      return response.edit('text', loading, '⚠️ **Error:** Could not find a recipe. The kitchen is closed.');
    }

    const caption = formatRecipe(meal);

    // Send Photo
    const sent = await response.upload('photo', meal.strMealThumb, {
      caption,
      reply_markup: createKeyboard(0)
    });

    // Cleanup loader
    await response.delete(loading).catch(() => {});

    // Update session ID
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
    await response.answerCallback(callbackQuery, { text: '🍳 Cooking...' });

    const meal = await fetchRecipe();
    if (!meal) throw new Error('Fetch failed');

    const caption = formatRecipe(meal);

    // Update Media & Caption
    await response.edit('media', message, 
      { 
        type: 'photo', 
        media: meal.strMealThumb, 
        caption 
      },
      { reply_markup: createKeyboard(message.message_id) }
    );

  } catch (err) {
    await response.answerCallback(callbackQuery, { text: '⚠️ Failed to refresh recipe', show_alert: true });
  }
}