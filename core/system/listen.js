import path from 'path';
import fs from 'fs';
import { Response } from '../handle/chat/response.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function listen({ bot, log }) {
  bot.on('message', async (msg) => {
    try {
      const response = new Response(bot, msg);
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const handlersPath = path.join(__dirname, '..', 'handle');
      const files = fs.readdirSync(handlersPath);
      for (const file of files) {
        if (file.endsWith('.js')) {
          const fullPath = path.join(handlersPath, file);

          // Use dynamic import for ESM compatibility; append query param for hot reload in development
          const handlerModule = await import(`${fullPath}?v=${Date.now()}`);

          const handlerName = path.basename(file, '.js');
          const handler = handlerModule[handlerName];

          if (typeof handler === 'function') {
            await handler({ bot, msg, chatId, userId, response, log });
          } else {
            console.warn(`Handler ${file} does not export a function named "${handlerName}".`);
          }
        }
      }
    } catch (error) {
      console.error('Error in message handler:', error);
    }
  });
}