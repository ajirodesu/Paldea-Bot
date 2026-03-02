/**
 * Goodbye Event Handler
 * Manages departure messages when members leave or are removed.
 */
export const meta = {
  name: "goodbye",
  version: "1.0.0",
  description: "Handles members leaving the group.",
  author: "ShawnDesu",
};

/**
 * Event Execution Logic
 */
export async function onEvent({ bot, msg, chatId, response }) {
  const leftMember = msg.left_chat_member;
  if (!leftMember) return;

  try {
    const botInfo = await bot.getMe();
    const { id: userId, first_name, last_name } = leftMember;
    const fullName = `${first_name}${last_name ? ' ' + last_name : ''}`.trim();

    // 1. Check if the BOT itself was removed
    if (userId === botInfo.id) {
      const chatInfo = await bot.getChat(chatId);
      const title = chatInfo.title || 'the group';
      const actorName = msg.from.first_name;

      console.log(`[Goodbye Event] Bot removed from "${title}" by ${actorName} (${msg.from.id})`);
      return; 
    }

    // 2. Determine leaving context (Left voluntarily vs Kicked)
    // msg.from.id is the person who performed the action.
    // If msg.from.id == leftMember.id, they left on their own.
    // Otherwise, they were removed/kicked by msg.from.
    const isKicked = msg.from.id !== userId;

    // Telegram's member count often updates slowly or includes the leaving member momentarily.
    // We try to get an approximate count.
    let memberCount = await bot.getChatMemberCount(chatId);
    // If logic suggests we need to subtract 1 manually:
    // memberCount = Math.max(0, memberCount - 1);

    let messageText = '';

    if (isKicked) {
      const actor = msg.from.first_name;
      messageText = `🚫 **${fullName}** was removed by ${actor}.`;
    } else {
      messageText = `👋 **Goodbye, ${fullName}.**\nWe'll miss you!`;
    }

    await response.send(messageText);

  } catch (err) {
    console.error('[Goodbye Event] Error:', err);
  }
}