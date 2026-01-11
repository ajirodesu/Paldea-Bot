import axios from 'axios';

// --- Configuration ---
const TIMEOUT = 5000;
const API_URL = 'http://ip-api.com/json';

/**
 * IP Lookup Command
 * Fetches geolocation data for a specific IP address.
 */
export const meta = {
  name: 'ip',
  version: '1.1.0',
  aliases: ['ipinfo', 'geoip', 'trace'],
  description: 'Get geolocation information for an IP address.',
  author: 'Prince',
  prefix: 'both',
  category: 'developer',
  type: 'developer',
  cooldown: 5,
  guide: ['<ip_address>']
};

export async function onStart({ args, response, usage }) {
  // 1. Parse Arguments (Support "ip get <ip>" or just "ip <ip>")
  let ip = args[0];
  if (ip && ip.toLowerCase() === 'get' && args[1]) {
    ip = args[1];
  }

  if (!ip) {
    return usage();
  }

  const loading = await response.reply(`🌍 **Locating** \`${ip}\`...`);

  try {
    // 2. Fetch Data
    const { data } = await axios.get(`${API_URL}/${ip}`, { timeout: TIMEOUT });

    // 3. Validate Response
    if (data.status !== 'success') {
      return response.edit('text', loading, `❌ **Lookup Failed**\nInvalid IP address or private network.`);
    }

    // 4. Format Output
    const message = 
      `📍 **IP Information**\n\n` +
      `💻 **Address:** \`${data.query || 'N/A'}\`\n` +
      `🌍 **Country:** ${data.country || 'N/A'} (${data.countryCode || '?'})\n` +
      `🏙️ **Region:** ${data.regionName || 'N/A'}\n` +
      `📍 **City:** ${data.city || 'N/A'}\n` +
      `📡 **ISP:** ${data.isp || 'N/A'}\n` +
      `🌐 **Coordinates:** \`${data.lat}, ${data.lon}\`\n\n` +
      `[View on Map](https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lon})`;

    // 5. Send Result
    await response.edit('text', loading, message);

  } catch (err) {
    await response.edit('text', loading, `⚠️ **System Error:**\n\`${err.message}\``);
  }
}