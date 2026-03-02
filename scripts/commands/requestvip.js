/**
 * Request VIP Command
 * Allows users to submit a formal request for VIP access to the bot developers.
 */
export const meta = {
  name: "requestvip",
  version: "1.1.0",
  aliases: ["reqvip", "viprequest"],
  description: "Submit a request for VIP access to the developers.",
  author: "ShawnDesu",
  category: "system",
  type: "anyone",
  cooldown: 120, // 2 minutes cooldown to prevent spam
  guide: ["<reason/message>"],
  prefix: "both"
};

export async function onStart({ msg, args, response, usage }) {
  // 1. Validation
  if (!args.length) return usage();

  const text = args.join(" ").trim();
  const { developers } = global.paldea.settings;

  // 2. Check if developers exist
  if (!developers || !developers.length) {
    return response.reply("⚠️ **System Error**\nNo developers are configured to receive this request.");
  }

  // 3. Construct User Details
  const from = msg.from;
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
  const username = from.username ? `@${from.username}` : "No Username";
  const userId = from.id;

  // 4. Build Notification Message
  const notification = 
    `📩 **VIP Request Received**\n\n` +
    `👤 **User:** ${name}\n` +
    `🏷️ **Username:** ${username}\n` +
    `🆔 **ID:** \`${userId}\`\n\n` +
    `📝 **Message:**\n_${text}_`;

  try {
    // 5. Send to Developers
    // using forDev wrapper to broadcast
    await response.forDev(notification);

    // 6. Confirm to User
    await response.reply("✅ **Request Sent**\nYour request has been forwarded to the developers for review.");

  } catch (err) {
    console.error('[RequestVIP] Error:', err.message);
    await response.reply(`⚠️ **Error:** Failed to send request.\n\`${err.message}\``);
  }
}