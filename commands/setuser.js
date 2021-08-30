const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../databaseHandler.js");
const { updateLog } = require("./../logHandler.js");

const emojiRegex = require("emoji-regex/RGI_Emoji.js");
const regex = emojiRegex();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setuser")
    .setDescription(
      "Adds a new user to the log database or changes their emoji if they are already registered."
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to be added or changed")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("emoji")
        .setDescription("The emoji to be assigned to the user")
        .setRequired(true)
    ),
  async execute(interaction) {
    let db = await openDb();
    const user = interaction.options.getUser("user");
    const emojiStr = interaction.options.getString("emoji");
    sql = `SELECT userid FROM users WHERE emoji = ? AND serverid = ? AND status = 1`;
    result = await db.get(sql, [emojiStr, interaction.guildId]);
    if (result) {
      interaction.reply({
        embeds: [
          {
            description: `Emoji could not be set. ${emojiStr} has already been assigned to <@${result.userid}>.`,
          },
        ],
      });
    } else {
      if (emojiStr.charAt(0) == "<") {
        // server specific emoji
        // search for emoji within server
        emoji = interaction.guild.emojis.cache.find(
          (emoji) =>
            emoji.id === emojiStr.slice(emojiStr.indexOf(":", 2) + 1, -1)
        );
        if (!emoji) {
          // emoji doesn't exist in server
          interaction.reply({
            embeds: [
              {
                description: `Emoji could not be set. Emojis must be default or available in this server.`,
              },
            ],
          });
        } else {
          sql = `INSERT OR REPLACE INTO users (serverid, userid, emoji, status) 
								VALUES (?, ?, ?, 1);`;
          db.run(sql, [interaction.guildId, user.id, emojiStr]);
          interaction.reply({
            embeds: [
              {
                description: `User <@!${user.id}> successfully set to ${emojiStr}.`,
              },
            ],
          });
        }
      } else if (!isValidEmoji(emojiStr)) {
        // emoji is not a regex
        interaction.reply({
          embeds: [
            {
              description: `Emoji could not be set. \`${emojiStr}\` is an invalid emoji.`,
            },
          ],
        });
      } else {
        // default emoji
        if (emojiStr == "✅") {
          interaction.reply({
            embeds: [
              {
                description: `Emoji could not be set. ✅ is an invalid emoji, try something else.`,
              },
            ],
          });
        } else if (emojiStr == "❌") {
          interaction.reply({
            embeds: [
              {
                description: `Emoji could not be set. ❌ is an invalid emoji, try something else.`,
              },
            ],
          });
        } else {
          sql = `INSERT OR REPLACE INTO users (serverid, userid, emoji, status) 
								VALUES (?, ?, ?, 1);`;
          db.run(sql, [interaction.guildId, user.id, emojiStr]).then(() => {
            updateLog(interaction.guild);
          });
          interaction.reply({
            embeds: [
              {
                description: `User <@!${user.id}> successfully set to ${emojiStr}.`,
              },
            ],
          });
        }
      }
    }
  },
};

function isValidEmoji(emojiStr) {
  let match;
  let emojisFound = 0;
  let fullEmoji = "";
  while ((match = regex.exec(emojiStr))) {
    emojisFound++;
    fullEmoji += match[0];
  }
  if (fullEmoji != emojiStr) {
    return false;
  }
  return emojisFound == 1;
}
