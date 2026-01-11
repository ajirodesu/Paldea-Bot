import axios from "axios";

/**
 * Notification Command
 * Interacts with the Shin REST API dashboard notification system.
 */
export const meta = {
  name: "notif",
  version: "1.0.0",
  aliases: [],
  description: "Send/Clear notifications on Shin REST API Dashboard",
  author: 'AjiroDesu',
  prefix: "both",
  category: "developer",
  type: "developer",
  cooldown: 3,
  guide: ["<message>", "clear"],
};

export async function onStart({ msg, args, response, usage }) {
  if (!args.length) return usage();

  const apiUrl = global.paldea.api?.shin;
  if (!apiUrl) return response.reply("⚠️ API URL not configured (global.paldea.api.shin).");

  try {
    const isClear = args[0].toLowerCase() === "clear";
    const endpoint = `${apiUrl}/api/notification`;

    const headers = {
      Authorization: "ajiro2005",
      "Content-Type": "application/json"
    };

    if (isClear) {
      await axios.post(endpoint, { clear: true }, { headers, timeout: 5000 });
      return response.reply("✅ All dashboard notifications cleared.");
    }

    const message = args.join(" ").trim();
    const firstName = msg.from.first_name || "Admin";

    await axios.post(endpoint, { message, firstName }, { headers, timeout: 5000 });

    return response.reply(`✅ **Notification Sent**\nDestination: ${apiUrl}/docs\nMessage: _${message}_`);

  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    console.error("[Notif] Error:", errMsg);
    return response.reply(`❌ **Failed:** ${errMsg}`);
  }
}