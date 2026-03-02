/**
 * Welcome Event Handler
 * Manages new member greetings and bot installation checks.
 */
export const meta = {
  name: "welcome",
  version: "1.0.0",
  description: "Handles new members joining and sends welcome messages.",
  author: "ShawnDesu",
};

/**
 * Event Execution Logic
 * @param {Object} context
 * @param {Object} context.bot - The Telegram Bot instance
 * @param {Object} context.msg - The message object triggering the event
 * @param {string|number} context.chatId - The ID of the chat
 * @param {Object} context.response - Custom response wrapper
 */
export async function onEvent({ bot, msg, chatId, response }) {
  const newMembers = msg.new_chat_members;
  if (!newMembers || !newMembers.length) return;

  try {
    const botInfo = await bot.getMe();
    const chatInfo = await bot.getChat(chatId);
    const groupTitle = chatInfo.title || "this group";

    // 1. Check if the BOT itself was added
    const isBotAdded = newMembers.some(member => member.id === botInfo.id);

    if (isBotAdded) {
      const chatMember = await bot.getChatMember(chatId, botInfo.id);

      // If bot is not admin, send a prompt
      if (chatMember.status !== 'administrator') {
        await response.send(
          `🎉 **System Online!**\n\n` +
          `Thank you for inviting **${botInfo.first_name}** to _${groupTitle}_.\n` +
          `⚠️ **Note:** For full functionality, please grant me **Admin** privileges.`
        );
      } else {
        await response.send(
          `🎉 **System Online!**\n\n` +
          `Thanks for inviting **${botInfo.first_name}** to _${groupTitle}_!\n` +
          `I am ready to serve.`
        );
      }
      return;
    }

    // 2. Handle regular users joining
    // Get fresh member count
    const memberCount = await bot.getChatMemberCount(chatId);

    for (const member of newMembers) {
      // Ignore other bots if preferred, or keep them. keeping them for now.
      const fullName = `${member.first_name}${member.last_name ? ' ' + member.last_name : ''}`.trim();

      await response.send(
        `👋 **Welcome, ${fullName}!**\n\n` +
        `Welcome to **${groupTitle}**! We hope you enjoy your stay.\n` +
        `👥 You are the **${memberCount}th** member.`
      );
    }

  } catch (err) {
    console.error('[Welcome Event] Error:', err);
    // Silent fail for events is usually preferred unless debugging
    // await response.forDev(`Error in welcome:\n${err.message}`); 
  }
}