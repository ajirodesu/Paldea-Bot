import axios from 'axios';

// --- Configuration ---
const TIMEOUT = 60000; // 60s timeout for generation
const BASE_URL = 'https://image.pollinations.ai/prompt';

/**
 * Pollinations AI Command
 * Generates images using the Pollinations Turbo model.
 */
export const meta = {
  name: 'pollinations',
  version: '1.1.0',
  aliases: ['polli', 'poli'],
  description: 'Generate AI art using Pollinations.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'imagegen',
  type: 'anyone',
  cooldown: 10,
  guide: ['<prompt>']
};

export async function onStart({ msg, args, response, usage }) {
  // 1. Resolve Prompt (Args or Reply)
  let prompt = args.join(' ');
  if (!prompt && msg.reply_to_message?.text) {
    prompt = msg.reply_to_message.text;
  }

  // 2. Validate
  if (!prompt) return usage();

  const loading = await response.reply(`🎨 **Dreaming up:** _${prompt}_...`);

  try {
    // 3. Construct URL
    // Adding nologo=true and fixing dimensions for better results
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `${BASE_URL}/${encodedPrompt}?model=turbo&width=1024&height=1024&nologo=true`;

    // 4. Fetch Image (Buffer)
    // We download it first to ensure Telegram doesn't timeout while waiting for the URL to render
    const { data } = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: TIMEOUT
    });

    // 5. Send Image
    await response.upload('photo', data, {
      caption: `🎨 **Generated Art**\n\n**Prompt:** _${prompt}_\n**Model:** Pollinations (Turbo)`
    });

    // 6. Cleanup
    await response.delete(loading).catch(() => {});

  } catch (err) {
    console.error('[Pollinations] Error:', err.message);
    await response.edit('text', loading, `⚠️ **Generation Failed:**\n\`${err.message}\``);
  }
}