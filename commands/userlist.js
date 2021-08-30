const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../databaseHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userlist")
    .setDescription(
      "Displays a list of registered users and their corresponding emojis."
    ),
  async execute(interaction) {
    let db = await openDb();
    sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
    users = await db.all(sql, [interaction.guildId]);

    formUsers = "";
    users.forEach((row) => {
      if (row.userid !== interaction.client.id) {
        formUsers += `${row.emoji} → `;
        formUsers += `<@!${row.userid}>\n`;
      }
    });
    interaction.reply({
      embeds: [
        {
          fields: [
            {
              name: `User list`,
              value: formUsers.slice(0, -1) || `No users set.`,
            },
          ],
        },
      ],
    });
  },
};
