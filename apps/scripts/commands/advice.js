import axios from 'axios';

const fetchAdvice = async () => {
  const { data } = await axios.get('https://api.adviceslip.com/advice', { 
    timeout: 5000,
    headers: { Accept: 'application/json' } 
  });
  return data?.slip?.advice || null;
};

const createKeyboard = (msgId) => ({
  inline_keyboard: [[
    { text: '🔁 Another', callback_data: JSON.stringify({ command: 'advice', id: msgId }) }
  ]]
});

export const meta = {
  name: 'advice',
  version: '1.1.0',
  aliases: ['tips'],
  description: 'Get random life advice.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'random',
  type: 'anyone',
  cooldown: 5,
  guide: [],
};

export async function onStart({ response }) {
  const loading = await response.reply('💭 **Seeking wisdom...**');

  try {
    const advice = await fetchAdvice();
    if (!advice) throw new Error('No advice returned.');

    await response.edit('text', loading, `💡 **Advice:**\n\n_${advice}_`, {
      reply_markup: createKeyboard(loading.message_id)
    });
  } catch (err) {
    await response.edit('text', loading, `⚠️ Error: ${err.message}`);
  }
}

export async function onCallback({ callbackQuery, payload, response }) {
  const { message } = callbackQuery;

  if (!message || payload.id !== message.message_id) {
    return response.answerCallback(callbackQuery, { text: '⚠️ Expired', show_alert: true });
  }

  try {
    const advice = await fetchAdvice();
    if (!advice) throw new Error('Fetch failed');

    await response.edit('text', message, `💡 **Advice:**\n\n_${advice}_`, {
      reply_markup: createKeyboard(message.message_id)
    });
    await response.answerCallback(callbackQuery, { text: '✓ Refreshed' });
  } catch (err) {
    await response.answerCallback(callbackQuery, { text: '⚠️ Error refreshing', show_alert: true });
  }
}