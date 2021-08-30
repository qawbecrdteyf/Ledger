const Discord = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../databaseHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clearchannel")
    .setDescription("Clears the assignment of a channel type.")
    .addStringOption((option) =>
      option
        .setName("channeltype")
        .setDescription("The type of channel being cleared")
        .setRequired(true)
        .addChoice("transactions", "transactions")
        .addChoice("log", "log")
        .addChoice("alerts", "alerts")
    ),
  async execute(interaction) {
    let db = await openDb();
    const channelType = interaction.options.getString("channeltype");

    switch (channelType) {
      case "transactions":
        sql = `UPDATE servers SET transactionsid = "" WHERE serverid = ?;`;
        break;
      case "log":
        sql = `UPDATE servers SET logid = "" WHERE serverid = ?;`;
        break;
      case "alerts":
        sql = `UPDATE servers SET alertsid = "" WHERE serverid = ?;`;
        break;
    }
    db.run(sql, [interaction.guildId]).then(() => {
      interaction.reply({
        embeds: [
          {
            description: `The ${channelType} channel has been cleared successfully.`,
          },
        ],
      });
    });
  },
};
