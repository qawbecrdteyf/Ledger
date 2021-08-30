const { Permissions } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../databaseHandler.js");
const { updateLog } = require("./../logHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("Assigns a channel to a certain role.")
    .addStringOption((option) =>
      option
        .setName("channeltype")
        .setDescription("The type of channel being assigned")
        .setRequired(true)
        .addChoice("transactions", "transactions")
        .addChoice("log", "log")
        .addChoice("alerts", "alerts")
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel being assigned")
        .setRequired(true)
    ),
  async execute(interaction) {
    let db = await openDb();
    const channelType = interaction.options.getString("channeltype");
    const setChannel = interaction.options.getChannel("channel");
    if (
      setChannel.type == "GUILD_TEXT" &&
      setChannel.permissionsFor(setChannel.guild.me).has(Permissions.FLAGS.SEND_MESSAGES) && setChannel.permissionsFor(setChannel.guild.me).has(Permissions.FLAGS.VIEW_CHANNEL)
    ) {
      switch (channelType) {
        case "transactions":
          sql = `UPDATE servers SET transactionsid = ? WHERE serverid = ?;`;
          db.run(sql, [setChannel.id, interaction.guildId]).then(() => {
            interaction.reply({
              embeds: [
                {
                  description: `<#${setChannel.id}> has successfully been set as the transactions channel.`,
                },
              ],
            });
          });
          break;
        case "log":
          sql = `UPDATE servers SET logid = ? WHERE serverid = ?;`;
          db.run(sql, [setChannel.id, interaction.guildId]).then(() => {
            updateLog(interaction.guild, setChannel.id);
            interaction.reply({
              embeds: [
                {
                  description: `<#${setChannel.id}> has successfully been set as the money log channel.`,
                },
              ],
            });
          });
          break;
        case "alerts":
          sql = `UPDATE servers SET alertsid = ? WHERE serverid = ?;`;
          db.run(sql, [setChannel.id, interaction.guildId]).then(() => {
            interaction.reply({
              embeds: [
                {
                  description: `<#${setChannel.id}> has successfully been set as the alerts channel.`,
                },
              ],
            });
          });
          break;
        default:
          interaction.reply({
            embeds: [
              {
                description: `Invalid channel type. Valid types: \`transactions | log | alerts\``,
              },
            ],
          });
      }
    } else {
      interaction.reply({
        embeds: [
          {
            description: `Channel could not be set. Make sure this bot has permissions to send messages in <#${setChannel.id}>`,
          },
        ],
      });
    }
  },
};
