const Discord = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../databaseHandler.js");
const { checkTransactionsChannel } = require("./../permissionHandler.js");

let l = {};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("Displays a list of all previous transactions."),
  async execute(interaction) {
    await interaction.deferReply();

    let db = await openDb();

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

      // loop thru them all and get info for each one
      tlist = [];
      invalidTransactions = 0; // deal with this later lol
      if (transactionids.length === 0) {
        // no transactions
        noTransactions(interaction);
      }
      transactionids.forEach((id) => {
        sql = ` SELECT 
                            owner,  
                            emoji
                        FROM
                            transactionhands INNER JOIN users 
                            ON transactionhands.recipient = users.userid AND 
                                transactionhands.serverid = users.serverid
                        WHERE 
                            transactionid = ?`;
        db.all(sql, [id.transactionid]).then((tarray) => {
          if (tarray.length > 0) {
            tlist.push({
              value: id.value,
              description: id.description,
              created: id.created,
              owner: tarray[0].owner,
              emojis: tarray.map((t) => t.emoji),
            });
          } else {
            invalidTransactions += 1;
          }

          if (tlist.length + invalidTransactions === transactionids.length) {
            // sort by created
            tlist.sort(function (a, b) {
              if (a.created > b.created) return 1;
              else return -1;
            });
            handleLog(interaction, tlist, interaction.user.id);
          }
        });
      });
    } else {
      interaction.editReply({
        embeds: [
          {
            description: `\`/history\` is a transaction command and can only be used within the set transactions channel, <#${validChannel}>`,
          },
        ],
      });
    }
  },
};

function noTransactions(interaction) {
  embed = new Discord.MessageEmbed()
    .setTitle(`Transaction log`)
    .setDescription(`No transactions found.`);
  interaction.editReply({ embeds: [embed] });
}

function handleLog(interaction, transactions, authorid) {
  embed = new Discord.MessageEmbed()
    .setTitle(`Transaction log`)
    .setDescription(
      getLogMessage(transactions, Math.max(transactions.length - 10, 0))
    );
  interaction.editReply({ embeds: [embed] }).then((m) => {
    l[(m.createdAt, authorid)] = transactions.length - 10;

    if (transactions.length > 10) {
      Promise.all([
        m.react("⏬"),
        m.react("⬇️"),
        m.react("⬆️"),
        m.react("⏫"),
      ]).catch((error) =>
        console.error("One of the emojis failed to react:", error)
      );

      const filter = (reaction, user) => {
        return (
          ["⏬", "⬇️", "⬆️", "⏫"].includes(reaction.emoji.name) &&
          user.id !== m.author.id
        );
      };

      // collector lasts for 2 minutes
      const collector = m.createReactionCollector({
        filter,
        time: 300000,
        dispose: true,
      });

      function handleReaction(reaction) {
        if (reaction.emoji.name === "⏬") {
          // go to the bottom of the list
          newEmbed = new Discord.MessageEmbed()
            .setTitle(`Transaction log`)
            .setDescription(
              getLogMessage(transactions, transactions.length - 10)
            );
          m.edit({ embeds: [newEmbed] });
          l[(m.createdAt, authorid)] = transactions.length - 10;
        } else if (reaction.emoji.name === "⬇️") {
          // go 10 down
          newEmbed = new Discord.MessageEmbed()
            .setTitle(`Transaction log`)
            .setDescription(
              getLogMessage(
                transactions,
                Math.min(
                  l[(m.createdAt, authorid)] + 10,
                  transactions.length - 10
                )
              )
            );
          m.edit({ embeds: [newEmbed] });
          l[(m.createdAt, authorid)] = Math.min(
            l[(m.createdAt, authorid)] + 10,
            transactions.length - 10
          );
        } else if (reaction.emoji.name === "⬆️") {
          // go 10 up
          newEmbed = new Discord.MessageEmbed()
            .setTitle(`Transaction log`)
            .setDescription(
              getLogMessage(
                transactions,
                Math.max(l[(m.createdAt, authorid)] - 10, 0)
              )
            );
          m.edit({ embeds: [newEmbed] });
          l[(m.createdAt, authorid)] = Math.max(
            l[(m.createdAt, authorid)] - 10,
            0
          );
        } else if (reaction.emoji.name === "⏫") {
          // go to the top of the list
          newEmbed = new Discord.MessageEmbed()
            .setTitle(`Transaction log`)
            .setDescription(getLogMessage(transactions, 0));
          m.edit({ embeds: [newEmbed] });
          l[(m.createdAt, authorid)] = 0;
        }
      }

      collector.on("collect", (reaction, user) => {
        handleReaction(reaction);
      });

      collector.on("remove", (reaction, user) => {
        handleReaction(reaction);
      });

      collector.on("end", (collected) => {
        m.reactions
          .removeAll()
          .catch((error) =>
            console.error("Failed to clear reactions: ", error)
          );
        newEmbed = new Discord.MessageEmbed()
          .setTitle(`Transaction log -- Inactive`)
          .setDescription(
            getLogMessage(transactions, l[(m.createdAt, authorid)])
          );
        m.edit({ embeds: [newEmbed] });
      });
    }
  });
}

function getLogMessage(transactions, startIndex) {
  retStr = ``;
  for (
    var i = startIndex;
    i < Math.min(startIndex + 10, transactions.length);
    ++i
  ) {
    if (transactions[i].description == "defaultPaidDescription") {
      // paid
      retStr += `${i + 1}) <@!${transactions[i].owner}> paid ${
        transactions[i].emojis[0]
      } `;
      retStr += `[₹${transactions[i].value.toFixed(2)}] | ${getFormattedDate(
        transactions[i].created
      )}\n`;
    } else if (transactions[i].value < 0) {
      // owe
      retStr += `${i + 1}) <@!${transactions[i].owner}> owes ${
        transactions[i].emojis[0]
      } `;
      retStr += `[₹${(-transactions[i].value).toFixed(2)}] `;
      if (transactions[i].description) {
        retStr += `"${transactions[i].description}" `;
      }
      retStr += `| ${getFormattedDate(transactions[i].created)}\n`;
    } else {
      // bought
      retStr += `${i + 1}) <@!${transactions[i].owner}> → `;
      transactions[i].emojis.forEach((emoji) => {
        retStr += emoji;
      });
      if (transactions[i].emojis.length > 1) {
        retStr += ` [₹${transactions[i].value.toFixed(2)}ea] `;
      } else {
        retStr += ` [₹${transactions[i].value.toFixed(2)}] `;
      }
      if (transactions[i].description) {
        retStr += `"${transactions[i].description}" `;
      }
      retStr += `| ${getFormattedDate(transactions[i].created)}\n`;
    }
  }

  return retStr;
}

function getFormattedDate(date) {
  date = new Date(date + "Z");
  d = date.getDate();
  m = date.getMonth() + 1;
  y = date.getFullYear();
  return m + "-" + (d <= 9 ? "0" + d : d) + "-" + y;
}
