import axios from 'axios';

/**
 * Command Metadata
 * Defines the configuration and behavior of the command within the bot framework.
 */
export const meta = {
  name: 'venice',
  version: '1.0.0',
  aliases: [], // Add aliases if needed, e.g., ['uncensored', 'v-ai']
  description: 'Chat with Venice AI (Uncensored Model)',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'AI',
  type: 'anyone',
  cooldown: 5, // Increased slightly to prevent API spamming
  guide: ['<prompt>'],
};

/**
 * Main execution function
 * @param {Object} context
 * @param {Object} context.msg - The standard Telegram message object
 * @param {string[]} context.args - Array of arguments passed with the command
 * @param {Object} context.response - Custom response wrapper for handling replies
 * @param {Function} context.usage - Function to trigger the usage guide
 */
export async function onStart({ msg, args, response, usage }) {
  // 1. Validation: Ensure user provided a prompt
  if (!args.length) return usage();

  const userPrompt = args.join(' ');
  let loadingMsg;

  try {
    // 2. UX: Send initial loading state
    loadingMsg = await response.reply('🧠 **Venice is thinking...**');

    // 3. Config Check: Fail fast if API URL is missing
    const apiUrl = global.paldea?.api?.shin;
    if (!apiUrl) {
      throw new Error('Server configuration error: API URL not defined.');
    }

    // 4. Network Request
    // Added timeout to prevent the bot from hanging indefinitely
    const { data } = await axios.get(`${apiUrl}/ai/venice`, {
      params: { question: userPrompt },
      timeout: 60000, // 60 seconds timeout
      headers: {
        'User-Agent': 'TelegramBot/1.0.0' // Good practice for API requests
      }
    });

    // 5. Response Extraction
    // Clean, prioritized fallback chain
    const aiResponse = data?.answer || data?.result || data?.message;

    if (!aiResponse) {
      throw new Error('The AI returned an empty response.');
    }

    // 6. Delivery: Edit the loading message with the result
    await response.edit('text', loadingMsg, aiResponse);

  } catch (error) {
    // 7. Professional Error Handling
    console.error(`[Venice Command Error] User: ${msg.sender?.id} | Error:`, error.message);

    const errorMessage = error.response
      ? `API Error: ${error.response.status} - ${error.response.statusText}`
      : `System Error: ${error.message}`;

    // Gracefully handle error delivery
    if (loadingMsg) {
      await response.edit('text', loadingMsg, `⚠️ **Request Failed**\n${errorMessage}`);
    } else {
      await response.reply(`⚠️ **Request Failed**\n${errorMessage}`);
    }
  }
}
