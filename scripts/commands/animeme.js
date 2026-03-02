import axios from 'axios';

const fetchAnimeme = async () => {
  const { data } = await axios.get('https://meme-api.com/gimme/animemes', { timeout: 10000 });
  return (data?.url && data?.title) ? data : null;
};

const createKeyboard = (msgId) => ({
  inline_keyboard: [[
    { text: '🔁 Refresh', callback_data: JSON.stringify({ command: 'animeme', id: msgId }) }
  ]]
});

export const meta = {
  name: 'animeme',
  version: '1.2.0',
  aliases: ['anime-meme'],
  description: 'Fetch a random anime meme from Reddit.',
  author: 'ShawnDesu',
  prefix: 'both',
  category: 'anime',
  type: 'anyone',
  cooldown: 5,
  guide: [],
};

export async function onStart({ response }) {
  const loading = await response.reply('🎭 **Fetching meme...**');

  try {
    const meme = await fetchAnimeme();
    if (!meme) throw new Error('API returned no content.');

    const sent = await response.upload('photo', meme.url, {
      caption: `**${meme.title}**`,
      parse_mode: 'Markdown',
      reply_markup: createKeyboard(0) // 0 initially
    });

    // Cleanup loader
    response.delete(loading).catch(() => {});

    // Update keyboard with actual message ID for validation
    if (sent?.message_id) {
      await response.edit('markup', sent, createKeyboard(sent.message_id));
    }

  } catch (err) {
    console.error('Animeme Error:', err.message);
    await response.edit('text', loading, `⚠️ **Error:** ${err.message}`);
  }
}

export async function onCallback({ callbackQuery, payload, response }) {
  const { message } = callbackQuery;

  // Validate Session
  if (!message || payload.id !== message.message_id) {
    return response.answerCallback(callbackQuery, { text: '⚠️ Session expired', show_alert: true });
  }

  try {
    await response.answerCallback(callbackQuery, { text: '🔄 Refreshing...' });

    const meme = await fetchAnimeme();
    if (!meme) throw new Error('No meme found');

    await response.edit('media', message, 
      { type: 'photo', media: meme.url, caption: `**${meme.title}**` },
      { reply_markup: createKeyboard(message.message_id) }
    );

  } catch (err) {
    await response.answerCallback(callbackQuery, { text: '⚠️ Failed to refresh', show_alert: true });
  }
}