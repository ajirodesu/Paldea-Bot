import axios from 'axios';

const fetchMeme = async () => {
  const { data } = await axios.get('https://meme-api.com/gimme/memes', { timeout: 10000 });
  return data?.url && data?.title ? data : null;
};

const createKeyboard = (msgId) => ({
  inline_keyboard: [[
    { text: '🔁', callback_data: JSON.stringify({ command: 'meme', id: msgId }) }
  ]]
});

export const meta = {
  name: 'meme',
  aliases: ['memes', 'randommeme'],
  version: '1.1.0',
  author: 'ShawnDesu',
  description: 'Sends a random meme.',
  guide: [],
  prefix: 'both',
  category: 'random',
  type: 'anyone',
  cooldown: 5,

  async onStart({ response }) {
    const loading = await response.reply('😂 **Fetching meme...**');

    try {
      const meme = await fetchMeme();
      if (!meme) throw new Error('Failed to fetch meme');

      const sent = await response.upload('photo', meme.url, {
        caption: meme.title,
        reply_markup: createKeyboard(0)
      });

      response.delete(loading).catch(() => {});

      if (sent?.message_id) {
        await response.edit('markup', sent, createKeyboard(sent.message_id)).catch(() => {});
      }
    } catch (err) {
      console.error('Error in meme onStart:', err.message);
      await response.edit('text', loading, '⚠️ Failed to fetch meme. Try again.');
    }
  },

  async onCallback({ bot, callbackQuery, payload, response }) {
    const { message } = callbackQuery;

    if (!message?.message_id || !payload?.id || payload.id !== message.message_id) {
      return response.answerCallback(callbackQuery, {
        text: '⚠️ Session expired',
        show_alert: true
      }).catch(() => {});
    }

    try {
      await response.answerCallback(callbackQuery, { text: '🔄 Refreshing...' }).catch(() => {});

      const meme = await fetchMeme();
      if (!meme) throw new Error('No meme data');

      await response.edit('media', message, {
        type: 'photo',
        media: meme.url,
        caption: meme.title
      }, {
        reply_markup: createKeyboard(message.message_id)
      });

      await response.answerCallback(callbackQuery, { text: '✓ Refreshed' }).catch(() => {});
    } catch (err) {
      console.error('Error in meme callback:', err.message);

      await response.answerCallback(callbackQuery, {
        text: '⚠️ Failed to refresh. Try again.',
        show_alert: true
      }).catch(() => {});
    }
  }
};