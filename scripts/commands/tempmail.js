import axios from 'axios';

// --- Configuration ---
const API_BASE = 'https://api.mail.tm';
const TIMEOUT = 15000;

// --- Helpers ---

/**
 * Fetches available domains from Mail.tm
 */
async function getDomain() {
  try {
    const { data } = await axios.get(`${API_BASE}/domains`, { timeout: TIMEOUT });
    const domains = data['hydra:member'];
    if (!domains?.length) return null;
    return domains[Math.floor(Math.random() * domains.length)].domain;
  } catch (err) {
    throw new Error(`Domain fetch failed: ${err.message}`);
  }
}

/**
 * Creates an account and retrieves the auth token.
 */
async function createAccount(address, password) {
  try {
    // 1. Create Account
    await axios.post(`${API_BASE}/accounts`, { address, password }, { 
      headers: { 'Content-Type': 'application/json' },
      timeout: TIMEOUT
    });

    // 2. Get Token
    const { data } = await axios.post(`${API_BASE}/token`, { address, password }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: TIMEOUT
    });

    return data.token;
  } catch (err) {
    throw new Error(`Account creation failed: ${err.message}`);
  }
}

/**
 * Temp Mail Generator Command
 * Creates a disposable email address using Mail.tm.
 */
export const meta = {
  name: 'tempmail',
  version: '1.1.0',
  aliases: ['genmail', 'fakeemail'],
  description: 'Generate a temporary email account.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'tools',
  type: 'anyone',
  cooldown: 10,
  guide: []
};

export async function onStart({ response, matches }) {
  const loading = await response.reply('📧 **Generating temporary email...**');

  try {
    // 1. Prepare Credentials
    const domain = await getDomain();
    if (!domain) throw new Error('No domains available service-side.');

    const randomStr = Math.random().toString(36).substring(2, 10);
    const email = `${randomStr}@${domain}`;
    const password = `Pwd${randomStr}!`; // Stronger password pattern just in case

    // 2. Execute Creation
    const token = await createAccount(email, password);

    // 3. Format Output
    const message = 
      `📮 **Temp Mail Generated**\n\n` +
      `📧 **Email:** \`${email}\`\n` +
      `🔑 **Password:** \`${password}\`\n\n` +
      `🪪 **Token:**\n\`${token}\`\n\n` +
      `⚠️ **Usage:** Copy the token above and use \`${matches}inbox <token>\` to check your messages.`;

    await response.edit('text', loading, message);

  } catch (err) {
    await response.edit('text', loading, `⚠️ **Error:** ${err.message}`);
  }
}