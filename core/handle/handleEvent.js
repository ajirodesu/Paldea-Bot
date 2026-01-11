export async function handleEvent({
  bot,
  msg,
  chatId,
  response
}) {
  const { events } = global.paldea;

  try {
    for (const event of events.values()) {
      if (event.onEvent) {
        await event.onEvent({
          bot,
          msg,
          chatId,
          response
        });
      }
    }
  } catch (error) {
    console.error(error.stack);
    response.reply(
      `❌ | ${error.message}\n${error.stack}\n${error.name}\n${error.code}\n${error.path}`,
    );
  }
}