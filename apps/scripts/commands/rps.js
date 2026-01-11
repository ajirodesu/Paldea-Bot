/**
 * Rock Paper Scissors Command
 * A classic game using inline buttons and session management.
 */
export const meta = {
  name: 'rps',
  version: '1.2.0',
  aliases: ['rockpaperscissors', 'janken'],
  description: 'Play a game of Rock, Paper, Scissors.',
  author: 'JohnDev19',
  prefix: 'both',
  category: 'fun',
  type: 'anyone',
  cooldown: 3,
  guide: []
};

// --- Constants ---
const CHOICES = ['rock', 'paper', 'scissors'];
const EMOJIS = { rock: '🪨', paper: '📄', scissors: '✂️' };

// --- Helpers ---

/**
 * Generates the game keyboard.
 * @param {number} msgId - Session ID (Message ID).
 */
const createKeyboard = (msgId) => ({
  inline_keyboard: [
    [
      { text: `Rock ${EMOJIS.rock}`, callback_data: JSON.stringify({ command: 'rps', id: msgId, c: 'rock' }) },
      { text: `Paper ${EMOJIS.paper}`, callback_data: JSON.stringify({ command: 'rps', id: msgId, c: 'paper' }) },
      { text: `Scissors ${EMOJIS.scissors}`, callback_data: JSON.stringify({ command: 'rps', id: msgId, c: 'scissors' }) }
    ]
  ]
});

/**
 * Generates the "Play Again" keyboard.
 */
const createReplayKeyboard = (msgId) => ({
  inline_keyboard: [[
    { text: '🔄 Play Again', callback_data: JSON.stringify({ command: 'rps', id: msgId, c: 'reset' }) }
  ]]
});

/**
 * Determines the winner.
 */
const getResult = (player, bot) => {
  if (player === bot) return { text: "It's a tie!", color: "🤝" };

  if (
    (player === 'rock' && bot === 'scissors') ||
    (player === 'paper' && bot === 'rock') ||
    (player === 'scissors' && bot === 'paper')
  ) {
    return { text: "You won!", color: "🎉" };
  }

  return { text: "You lost!", color: "💀" };
};

// --- Command Handlers ---

export async function onStart({ response }) {
  // 1. Send initial message with placeholder ID (0)
  const sent = await response.reply('🤜 **Rock, Paper, Scissors!**\nChoose your weapon:', {
    reply_markup: createKeyboard(0)
  });

  // 2. Update keyboard with actual message ID for session validation
  if (sent?.message_id) {
    await response.edit('markup', sent, createKeyboard(sent.message_id));
  }
}

export async function onCallback({ bot, callbackQuery, payload, response }) {
  const { message } = callbackQuery;

  // 1. Validate Session
  if (!message || payload.id !== message.message_id) {
    return response.answerCallback(callbackQuery, { text: '⚠️ Session expired', show_alert: true });
  }

  try {
    // 2. Handle "Play Again" / Reset
    if (payload.c === 'reset') {
      await response.edit('text', message, '🤜 **Rock, Paper, Scissors!**\nChoose your weapon:', {
        reply_markup: createKeyboard(message.message_id)
      });
      return response.answerCallback(callbackQuery, { text: 'New game started!' });
    }

    // 3. Game Logic
    const playerChoice = payload.c;

    if (!CHOICES.includes(playerChoice)) {
      return response.answerCallback(callbackQuery, { text: 'Invalid move.' });
    }

    const botChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)];
    const result = getResult(playerChoice, botChoice);

    const resultMessage = 
      `**Result:** ${result.text} ${result.color}\n\n` +
      `👤 You: **${playerChoice.toUpperCase()}** ${EMOJIS[playerChoice]}\n` +
      `🤖 Bot: **${botChoice.toUpperCase()}** ${EMOJIS[botChoice]}`;

    // 4. Update Message (Show result + Play Again button)
    await response.edit('text', message, resultMessage, {
      reply_markup: createReplayKeyboard(message.message_id)
    });

    await response.answerCallback(callbackQuery);

  } catch (err) {
    await response.answerCallback(callbackQuery, { text: '⚠️ Error processing game.', show_alert: true });
  }
}