const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setuphelp")
    .setDescription(
      "Displays a detailed list of Ledger's setup commands and what they do."
    ),
  async execute(interaction) {
    await interaction.reply({
      embeds: [
        {
          title: `:gear: My setup commands: :wrench:`,
          color: 0x2471a3,
          fields: [
            {
              name: `/help`,
              value: `Displays a full list of Ledger's commands.\n----------`,
            },
            {
              name: `/moneyhelp`,
              value: `Displays all of Ledger's money commands with detailed descriptions of what they do and how to use them.\n----------`,
            },
            {
              name: `/setuphelp`,
              value: `Displays all of Ledger's setup commands with detailed descriptions of what they do and how to use them.\n----------`,
            },
            {
              name: `/setuser [@user] [emoji]`,
              value: `Registers a user with the bot and assigns them to an emoji. This emoji may be custom, but must be from within the local server. The emoji must be unique to this user. The first input should mention the user using the @ functionality. If the given user has already been set, their emoji will be updated to the emoji provided.\n----------`,
            },
            {
              name: `/removeuser [@user]`,
              value: `Removes a user from active status within the bot. This will still prevent other users from adding new transactions involving this user, but will leave the user's older transactions within the history log. The input should mention the user using the @ functionality.\n----------`,
            },
            {
              name: `/userlist`,
              value: `Displays a list of all active users.\n----------`,
            },
            {
              name: `/setchannel {transactions | log | alerts} [#channel]`,
              value: `Assigns a channel to be dedicated to a topic. The second input should link a channel using the # functionality. \n**Transactions channel:** All commands listed under \`/moneyHelp\` can only be used in this channel. \n**Log channel:** A log embed will be sent to this channel. This embed will update with every new transaction or update to users. It is recommended that this channel be set to read-only so that the log may always be easily accessible. \n**Alerts channel:** All warnings about missing users or channels will be sent to this channel. By default, they will be sent instead to the first channel accessible to the bot.\n----------`,
            },
            {
              name: `/clearchannel {transactions | log | alerts}`,
              value: `Clears the assignment of this channel type. If a channel was previously set to this topic, it will be removed. Removal of a log channel will not remove the log embed, but it will cause the message to no longer update.\n----------`,
            },
            {
              name: `/channellist`,
              value: `Displays a list of the channel topic assignments.`,
            },
          ],
        },
      ],
    });
  },
};
