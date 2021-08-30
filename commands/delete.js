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
    .setName("delete")
    .setDescription("Removes a transaction from the log.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("number")
        .setDescription("Delete a specific number transaction")
        .addIntegerOption((option) =>
          option
            .setName("transaction")
            .setDescription("The number of the transaction to be deleted")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("last")
        .setDescription("Delete the most recent transaction")
    ),
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
        // get all transactionids in this server
        sql = ` SELECT 
                            transactionid, 
                            value, 
                            description, 
                            created 
                        FROM 
                            transactions 
                        WHERE 
                            serverid = ?`;

        transactionids = await db.all(sql, [interaction.guildId]);

        let num;

        if (interaction.options.getSubcommand() === "number") {
          num = interaction.options.getInteger("transaction");
        } else {
          // last
          num = transactionids.length;
        }

        if (num <= 0) {
          interaction.editReply({
            embeds: [
              {
                description: `Invalid command usage: the value submitted must be a positive value.`,
              },
            ],
          });
        } else if (num > transactionids.length) {
          interaction.editReply({
            embeds: [
              {
                description: `Invalid command usage: ${num} is not a valid transaction number.`,
              },
            ],
          });
        } else {
          transactionids.sort(function (a, b) {
            if (a.created > b.created) return 1;
            else return -1;
          });

          sql = ` SELECT 
                                owner,  
                                emoji
                            FROM
                                transactionhands INNER JOIN users 
                                ON transactionhands.recipient = users.userid AND 
                                    transactionhands.serverid = users.serverid
                            WHERE 
                                transactionid = ?`;

          recipients = await db.all(sql, [
            transactionids[num - 1].transactionid,
          ]);

          (async function () {
            handleDelete(
              interaction,
              interaction.user.id,
              transactionids[num - 1],
              recipients,
              num - 1
            ).then((result) => {
              if (result === 1) {
                transactionid = transactionids[num - 1].transactionid;
                db.run(
                  `DELETE FROM transactions WHERE serverid = ? AND transactionid = ?;`,
                  [interaction.guildId, transactionid]
                ).then(() => {
                  updateLog(interaction.guild);
                });
                db.run(
                  `DELETE FROM transactionhands WHERE serverid = ? AND transactionid = ?;`,
                  [interaction.guildId, transactionid]
                );
              }
            });
          })();
        }
      } else {
        interaction.editReply({
          embeds: [
            {
              description: `\`/delete\` is a transaction command and can only be used within the set transactions channel, <#${validChannel}>`,
            },
          ],
        });
      }
    }
  },
};

async function handleDelete(
  interaction,
  authorid,
  transaction,
  recipients,
  number
) {
  return new Promise((resolve, reject) => {
    emojis = ["❌", "✅"];

    var descString = `**Transaction #${number}:**\n`;
    if (transaction.description !== "defaultPaidDescription") {
      descString += `<@!${recipients[0].owner}> → `;
      recipients.forEach((recipient) => {
        descString += recipient.emoji;
      });
      if (recipients.length > 1) {
        descString += ` [₹${transaction.value.toFixed(2)}ea] `;
      } else {
        descString += ` [₹${transaction.value.toFixed(2)}] `;
      }
      if (transaction.description) {
        descString += `"${transaction.description}" `;
      }
      descString += `| ${getFormattedDate(transaction.created)}\n`;
    } else {
      descString += `<@!${recipients[0].owner}> paid ${recipients[0].emoji} `;
      descString += `[₹${transaction.value.toFixed(2)}] | ${getFormattedDate(
        transaction.created
      )}\n`;
    }

    embed = new Discord.MessageEmbed()
      .setTitle(`Delete this transaction?`)
      .setDescription(descString)
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
                description: `Action timed out - transaction #${number} has not been deleted.`,
                color: 0xff0000,
              },
            ],
          });
        } else if (collected.keys().next().value === "❌") {
          resolve(0);
          interaction.editReply({
            embeds: [
              {
                description: `Action cancelled - transaction #${number} has not been deleted.`,
                color: 0xff0000,
              },
            ],
          });
        } else if (collected.keys().next().value === "✅") {
          resolve(1);
          interaction.editReply({
            embeds: [
              {
                description: `Transaction #${number} deleted successfully.`,
                color: 0x00ff00,
              },
            ],
          });
        }
      });
    });
  });
}

function getFormattedDate(date) {
  date = new Date(date + "Z");
  d = date.getDate();
  m = date.getMonth() + 1;
  y = date.getFullYear();
  return m + "-" + (d <= 9 ? "0" + d : d) + "-" + y;
}
