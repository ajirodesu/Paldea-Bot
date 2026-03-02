import axios from 'axios';

// --- Configuration ---
const TIMEOUT = 30000; // 30s timeout (Screenshots can be slow)
const API_BASE = 'https://api.pikwy.com/';

// --- Helpers ---

/**
 * Validates if a string is a proper URL.
 */
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Screenshot Command
 * Captures a full-page screenshot of a website using Pikwy.
 */
export const meta = {
  name: 'screenshot',
  version: '1.1.0',
  aliases: ['webshot', 'ss', 'snap'],
  description: 'Capture a screenshot of a website.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'tools',
  type: 'anyone',
  cooldown: 10,
  guide: ['<url>']
};

export async function onStart({ args, response, usage }) {
  let url = args[0];

  // 1. Validation
  if (!url) return usage();

  // Auto-prepend https:// if missing
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  if (!isValidUrl(url)) {
    return response.reply('⚠️ **Invalid URL**\nPlease provide a valid link (e.g., `google.com`).');
  }

  const loading = await response.reply('🖼️ **Capturing screenshot...**\n_This may take a moment._');

  try {
    // 2. Prepare API Request
    // Parameters: tkn=125 (public), d=3000 (delay), w/h (viewport), f=jpg (format)
    const apiUrl = `${API_BASE}?tkn=125&d=3000&fs=0&w=1280&h=1200&s=100&z=100&f=jpg&rt=jweb&u=${encodeURIComponent(url)}`;

    const { data } = await axios.get(apiUrl, { timeout: TIMEOUT });

    if (!data || !data.iurl) {
      throw new Error('API returned no image URL.');
    }

    // 3. Send Screenshot
    // Note: Pikwy returns a hosted URL (data.iurl). We upload that directly.
    await response.upload('photo', data.iurl, {
      caption: `🖼️ **Web Capture**\n🌐 **URL:** ${url}`
    });

    // 4. Cleanup
    await response.delete(loading).catch(() => {});

  } catch (err) {
    console.error('[Screenshot] Error:', err.message);
    await response.edit('text', loading, `⚠️ **Capture Failed:**\n\`${err.message}\``);
  }
}