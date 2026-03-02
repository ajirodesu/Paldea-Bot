import axios from 'axios';

// --- Constants ---
const TIMEOUT = 10000;

// --- Helpers ---

async function fetchCat() {
  try {
    // Ensure API URL exists, fallback to public API if internal one is missing
    const baseUrl = global.paldea?.api?.nekolabs || 'https://api.nekolabs.web.id'; 
    const url = `${baseUrl}/random/cat`;

    const { data } = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: TIMEOUT 
    });

    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Cat Command
 * Fetches a random cat image from NekoLabs API.
 */
export const meta = {
  name: 'cat',
  version: '1.2.0',
  aliases: ['catphoto', 'meow', 'neko'],
  description: 'Send a random cat photo.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'random',
  type: 'anyone',
  cooldown: 5,
  guide: []
};

export async function onStart({ response }) {
  const loading = await response.reply('🐱 **Fetching a cat...**');

  try {
    const imageBuffer = await fetchCat();

    // Send Photo (No keyboard/buttons)
    await response.upload('photo', imageBuffer, {
      caption: '📸 **Random Cat Photo**'
    });

    // Remove loading text
    await response.delete(loading).catch(() => {});

  } catch (err) {
    await response.edit('text', loading, `⚠️ **Error:** Failed to fetch cat photo.\n\`${err.message}\``);
  }
}