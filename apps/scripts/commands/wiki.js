import axios from 'axios';

/**
 * Command Metadata
 * Defines the configuration and behavior of the command within the bot framework.
 */
export const meta = {
  name: 'wiki',
  version: '1.0.0',
  aliases: ['wikipedia', 'wp'],
  description: 'Search Wikipedia for a summary of a topic',
  author: 'xAI',
  prefix: 'both',
  category: 'Reference',
  type: 'anyone',
  cooldown: 5,
  guide: ['<search term>'],
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
  // 1. Validation: Ensure user provided a search term
  if (!args.length) return usage();

  const query = args.join(' ');
  let loadingMsg;

  try {
    // 2. UX: Send initial loading state
    loadingMsg = await response.reply('🔍 **Searching Wikipedia...**');

    // 3. Network Request to Wikipedia API
    const apiUrl = 'https://en.wikipedia.org/w/api.php';
    const { data } = await axios.get(apiUrl, {
      params: {
        action: 'query',
        format: 'json',
        prop: 'extracts',
        exintro: true,
        explaintext: true,
        redirects: 1,
        titles: query,
      },
      timeout: 30000, // 30 seconds timeout
      headers: {
        'User-Agent': 'TelegramBot/1.0.0' // Good practice for API requests
      }
    });

    // 4. Response Extraction
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') {
      throw new Error('No matching Wikipedia page found.');
    }

    const title = pages[pageId].title;
    const extract = pages[pageId].extract;
    if (!extract) {
      throw new Error('No summary available for this topic.');
    }

    // Format the response with title and extract
    const aiResponse = `**${title}**\n\n${extract}`;

    // 5. Delivery: Edit the loading message with the result
    await response.edit('text', loadingMsg, aiResponse);

  } catch (error) {
    // 6. Professional Error Handling
    console.error(`[Wiki Command Error] User: ${msg.sender?.id} | Error:`, error.message);

    const errorMessage = error.response
      ? `API Error: ${error.response.status} - ${error.response.statusText}`
      : `System Error: ${error.message}`;

    // Gracefully handle error delivery
    if (loadingMsg) {
      await response.edit('text', loadingMsg, `⚠️ **Search Failed**\n${errorMessage}`);
    } else {
      await response.reply(`⚠️ **Search Failed**\n${errorMessage}`);
    }
  }
}