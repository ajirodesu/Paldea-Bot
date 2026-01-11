export async function handleReply({ bot, response, msg, chatId, userId, log }) {
  const { replies, commands } = global.paldea;
  const args = (msg.text && msg.text.trim()) ? msg.text.trim().split(/\s+/) : [];

  if (!msg.reply_to_message) {
    return;
  }

  const replyData = replies.get(msg.reply_to_message.message_id);
  if (!replyData) {
    return;
  }

  const { meta, ...data } = replyData;

  if (!meta || !meta.name) {
    await response.reply("Cannot find command name to execute this reply!");
    return;
  }

  const commandName = meta.name;
  const command = commands.get(commandName);
  if (!command) {
    await response.reply(`Cannot find command: ${commandName}`);
    return;
  }

  if (!command.onReply) {
    await response.reply(`Command **${commandName}** doesn't support replies`);
    return;
  }

  try {
    await command.onReply({
      bot,
      response,
      msg,
      chatId,
      userId,
      args,
      data,
      commandName,
      replyMsg: msg.reply_to_message,
    });
  } catch (err) {
    const errorMessage = `An error occurred while processing your reply: ${err.message}`;
    await response.reply(errorMessage);
  }
}