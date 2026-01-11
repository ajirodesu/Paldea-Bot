import path from 'path';

const ITEMS_PER_PAGE = 10;

export const meta = {
  name: "worldclock",
  version: "1.0.0",
  aliases: ["time", "clock", "tz"],
  description: "Shows current time in any country or city.",
  author: "Francis Loyd Raval",
  prefix: "both",
  category: "utility",
  type: "anyone",
  cooldown: 5,
  guide: ["[search term]", "list [page]"]
};

export async function onStart({ args, response, usage }) {
  const timezoneModule = await import(path.join(process.cwd(), 'apps/patches/helpers/timezones.js'));
  const { timezones } = timezoneModule;

  // 1. Default View (No Args)
  if (args.length === 0) {
    const now = new Date();
    const sample = timezones.slice(0, 10);

    const times = sample.map(({ name, tz }) => {
      const timeStr = now.toLocaleTimeString("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const offsetPart = Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "shortOffset",
      }).formatToParts(now).find(p => p.type === "timeZoneName");

      const offset = offsetPart ? offsetPart.value : "";
      return `**${name}**: ${timeStr} ${offset}`;
    }).join("\n");

    return response.reply(
      `🌍 **World Clock** • Showing **10** of **${timezones.length}** zones\n\n` +
      times +
      `\n\n**Usage**: \`/worldclock <search>\`\n` +
      `**Example**: \`/worldclock japan\``
    );
  }

  const query = args.join(" ").toLowerCase().trim();

  // 2. List View
  if (query.startsWith("list")) {
    const pageArg = args[1];
    const page = pageArg && !isNaN(Number(pageArg)) ? parseInt(pageArg, 10) : 1;
    const totalPages = Math.ceil(timezones.length / ITEMS_PER_PAGE);

    if (page < 1 || page > totalPages) {
      return response.reply(`⚠️ Invalid page. Use 1–${totalPages}.`);
    }

    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = timezones.slice(start, end);

    const list = pageItems
      .map((z, i) => `${String(start + i + 1).padStart(3, " ")}. ${z.name}`)
      .join("\n");

    return response.reply(
      `🌐 **All Time Zones** • Page **${page}/${totalPages}**\n\`\`\`\n${list}\n\`\`\``
    );
  }

  // 3. Search View
  const matches = timezones.filter(
    z => z.name.toLowerCase().includes(query) || z.tz.toLowerCase().includes(query)
  );

  if (matches.length === 0) {
    return response.reply(`❌ No time zone found for "**${query}**". Try \`/worldclock list\`.`);
  }

  const now = new Date();
  const results = matches.map(({ name, tz }) => {
    const full = now.toLocaleString("en-US", {
      timeZone: tz,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
    return `📍 **${name}** (${tz})\n🕒 ${full}`;
  }).join("\n\n");

  const header = matches.length === 1
    ? `Current time in **${matches[0].name}**`
    : `**${matches.length}** matching time zone${matches.length > 1 ? "s" : ""}`;

  await response.reply(`${header}\n\n${results}`);
}