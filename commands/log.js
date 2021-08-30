const { SlashCommandBuilder } = require("@discordjs/builders");
const { getLogEmbed } = require("./../logHandler.js");
const { checkTransactionsChannel } = require("./../permissionHandler.js");

let l = {};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("log")
    .setDescription(
      "Displays the current log of balances between registered users."
    ),
  async execute(interaction) {
    await interaction.deferReply();

    let validChannel = await checkTransactionsChannel(
      interaction.channelId,
      interaction.guildId
    );
    if (!validChannel) {
      interaction.editReply({ embeds: [await getLogEmbed(interaction.guild)] });
    } else {
      interaction.editReply({
        embeds: [
          {
            description: `\`/log\` is a transaction command and can only be used within the set transactions channel, <#${validChannel}>`,
          },
        ],
      });
    }
  },
};
