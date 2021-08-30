const { SlashCommandBuilder } = require("@discordjs/builders");

let desc = `- All of these commands are slash commands; utilize the autofill and input regulation to avoid misinputs.
- Inputs within {} are literals - type the option which fits your need exactly.
- Inputs within [] are variables describing what you need to submit.
- Inputs which are italicized are optional.
- **The bracket characters are not included in any command.**`;

let setupCmds = `/help
/setuser [@user] [emoji]
/removeuser [@user]
/userlist
/setchannel {transactions | log | alerts} [#channel]
/clearchannel {transactions | log | alerts}
/channellist

For more information on these commands, use \`/setupHelp\`.`;

let moneyCmds = `/bought [money value] *[description]*
/paid [money value] *[@user being paid]*
/owe [money value] *[@user owed to]* *[description]*
/log
/history
/delete {last | [number of transaction to delete]}
/cleartransactions

For more information on these commands, use \`/moneyHelp\`.`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Displays a list of Ledger's commands."),
  async execute(interaction) {
    await interaction.reply({
      embeds: [
        {
          title: `My commands:`,
          color: 0x2471a3,
          description: desc,
          fields: [
            {
              name: ":gear: Setup and logistics :wrench:",
              value: setupCmds,
            },
            {
              name: ":moneybag: Money :money_with_wings:",
              value: moneyCmds,
            },
          ],
        },
      ],
    });
  },
};
