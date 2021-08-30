const Discord = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../databaseHandler.js");
const { updateLog } = require("./../logHandler.js");
const {
  checkValidUser,
  checkTransactionsChannel,
} = require("./../permissionHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cleartransactions")
    .setDescription("Clears all transactions from the log."),
  async execute(interaction) {
    await interaction.deferReply();

    let db = await openDb();

    sql = `SELECT userid FROM users WHERE userid = ? AND serverid = ? AND status = 1`;
    let validUser = await checkValidUser(interaction);
    if (validUser) {
      let validChannel = await checkTransactionsChannel(
        interaction.channelId,
        interaction.guildId
      );
      if (!validChannel) {
        (async function () {
          handleClear(interaction, interaction.user.id).then((result) => {
            if (result === 1) {
              db.run(`DELETE FROM transactions WHERE serverid = ?;`, [
                interaction.guildId,
              ]).then(() => {
                updateLog(interaction.guild);
              });
              db.run(`DELETE FROM transactionhands WHERE serverid = ?;`, [
                interaction.guildId,
              ]);
            }
          });
        })();
      } else {
        interaction.editReply({
          embeds: [
            {
              description: `\`/cleartransactions\` is a transaction command and can only be used within the set transactions channel, <#${validChannel}>`,
            },
          ],
        });
      }
    }
  },
};

async function handleClear(interaction, authorid) {
  return new Promise((resolve, reject) => {
    emojis = ["❌", "✅"];

    embed = new Discord.MessageEmbed()
      .setDescription(
        `**Warning:** By confirming this action, all transactions logged in this server will be permanently deleted. Do you wish to continue?`
      )
      .setFooter(`React with ✅ to confirm or ❌ to cancel this action.`);
    interaction.editReply({ embeds: [embed] }).then((m) => {
      Promise.all([m.react("✅"), m.react("❌")]).catch((error) =>
        console.error("One of the emojis failed to react:", error)
      );

      const filter = (reaction, user) => {
        return emojis.includes(reaction.emoji.name) && user.id !== m.author.id;
      };

      // collector lasts for 2 minutes before cancelling
      const collector = m.createReactionCollector({
        filter,
        time: 120000,
        dispose: true,
      });

      collector.on("collect", (reaction, user) => {
        if (user.id === authorid) {
          collector.stop();
        }
      });

      collector.on("end", (collected) => {
        m.reactions
          .removeAll()
          .catch((error) =>
            console.error("Failed to clear reactions: ", error)
          );
        if (collected.length === 0) {
          resolve(-1);
          interaction.editReply({
            embeds: [
              {
                description: `Action timed out - transactions have not been cleared.`,
                color: 0xff0000,
              },
            ],
          });
        } else if (collected.keys().next().value === "❌") {
          resolve(0);
          interaction.editReply({
            embeds: [
              {
                description: `Action cancelled - transactions have not been cleared.`,
                color: 0xff0000,
              },
            ],
          });
        } else if (collected.keys().next().value === "✅") {
          resolve(1);
          interaction.editReply({
            embeds: [
              {
                description: `Transactions cleared successfully.`,
                color: 0x00ff00,
              },
            ],
          });
        }
      });
    });
  });
}
