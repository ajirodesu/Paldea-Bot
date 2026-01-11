// handleChat.js - Updated to pass usersData, groupsData and renamed

export async function handleChat({ bot, response, msg, chatId, userId }) {
  const { commands } = global.paldea;
  const args = (msg.text && msg.text.trim()) ? msg.text.trim().split(/\s+/) : [];

  for (const [commandName, command] of commands.entries()) {
    if (command.onChat) {
      try {
        const shouldContinue = await command.onChat({
          bot,
          response,
          msg,
          chatId,
          args
        });
        if (shouldContinue === false) {
          break;
        }
      } catch (error) {
        console.error(`Error executing onChat for command "${commandName}":`, error);
      }
    }
  }
}