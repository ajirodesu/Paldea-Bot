/**
 * Chat ID Command
 * Quickly retrieve the current chat's ID and details.
 */

export const meta = {
  name: 'gid',
  version: '1.0.0',
  aliases: ['chatid', 'tid'],
  description: 'View the current Chat ID and group information.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'group',
  type: 'group',
  cooldown: 2,
  guide: []
};

export async function onStart({ msg, response }) {
  const { id, title, type, first_name, last_name } = msg.chat;

  // Resolve the display name based on chat type (Group vs Private)
  const name = title || [first_name, last_name].filter(Boolean).join(' ') || 'Unknown';

  let replyMsg = `🆔 **Chat Information**\n\n`;
  replyMsg += `📛 **Name:** ${name}\n`;
  replyMsg += `🔢 **ID:** \`${id}\`\n`;
  replyMsg += `📂 **Type:** ${type.toUpperCase()}`;

  // Support for Telegram Forum Topics
  // If the message is sent inside a specific topic, show that ID too.
  if (msg.message_thread_id) {
    replyMsg += `\n📑 **Topic ID:** \`${msg.message_thread_id}\``;
  }

  return response.reply(replyMsg);
}