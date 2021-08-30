const Discord = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { openDb } = require("./../databaseHandler.js");
const { updateLog } = require("./../logHandler.js");
const {
  checkValidUser,
  checkTransactionsChannel,
} = require("./../permissionHandler.js");

const StatusEnum = Object.freeze({
  WORKING: 1,
  GOOD: 2,
  CANCELLED: 3,
  TIMEDOUT: 4,
});

let t = {};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bought")
    .setDescription("Logs a new transaction.")
    .addIntegerOption((option) =>
      option
        .setName("cost")
        .setDescription("The total value being charged")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("The description of the transaction")
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    let db = await openDb();
    const cost = interaction.options.getInteger("cost");
    const description = interaction.options.getString("description");
    sql = `SELECT userid FROM users WHERE userid = ? AND serverid = ? AND status = 1`;
    let validUser = await checkValidUser(interaction);
    if (validUser) {
      let validChannel = await checkTransactionsChannel(
        interaction.channelId,
        interaction.guildId
      );
      if (!validChannel) {
        if (cost <= 0) {
          interaction.editReply({
            embeds: [
              {
                description: `Invalid command usage: the value submitted must be a positive value.`,
              },
            ],
          });
        } else if (description === "defaultPaidDescription") {
          interaction.editReply({
            embeds: [
              {
                description: `Congrats! You've found the one description message you are not allowed to use. Please try again.`,
              },
            ],
          });
        } else if (description && description.length > 200) {
          interaction.editReply({
            embeds: [
              {
                description: `Invalid command usage: the description submitted must be <200 characters long.`,
              },
            ],
          });
        } else {
          sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
          users = await db.all(sql, [interaction.guildId]);
          (async function () {
            handleTransaction(
              interaction,
              interaction.user.id,
              users,
              getFormattedUsers(users),
              cost,
              description
            ).then((recipients) => {
              if (recipients[0] !== 0 && recipients[0] !== -1) {
                sql = `INSERT INTO transactions (serverid, value, description)
                                        VALUES (?, ?, ?);`;
                db.run(sql, [
                  interaction.guildId,
                  cost / recipients.length,
                  description,
                ]).then(() => {
                  db.run("SELECT last_insert_rowid()").then((transactionid) => {
                    recipients.forEach((recipient) => {
                      sql = `INSERT INTO transactionhands (serverid, transactionid, owner, recipient)
                                                    VALUES (?, ?, ?, ?);`;
                      db.run(sql, [
                        interaction.guildId,
                        transactionid.lastID,
                        interaction.user.id,
                        recipient.userid,
                      ]).then(() => {
                        updateLog(interaction.guild);
                      });
                    });
                  });
                });
              }
            });
          })();
        }
      } else {
        interaction.editReply({
          embeds: [
            {
              description: `\`/bought\` is a transaction command and can only be used within the set transactions channel, <#${validChannel}>`,
            },
          ],
        });
      }
    }
  },
};

async function handleTransaction(
  interaction,
  authorid,
  users,
  strUsers,
  value,
  description
) {
  return new Promise((resolve, reject) => {
    emojis = users.map((user) => {
      if (user.emoji.charAt(0) === "<") {
        return user.emoji.slice(2, user.emoji.indexOf(":", 2));
      } else {
        return `${user.emoji}`;
      }
    });
    emojis.push("❌");
    emojis.push("✅");

    info = {
      recipients: [],
      value: value,
      description: description,
      emojis: emojis,
      status: StatusEnum.WORKING,
    };

    embed = new Discord.MessageEmbed()
      .setTitle(`New transaction...`)
      .addFields(
        { name: `Select recipients of this transaction:`, value: strUsers },
        {
          name: `Current recipients:`,
          value: getInfoString(info, users.length),
        }
      )
      .setFooter(
        `React with ✅ when finished selecting recipients.\nReact with ❌ to cancel this transaction.`
      );
    interaction.editReply({ embeds: [embed] }).then((m) => {
      t[(m.createdAt, authorid)] = info;

      Promise.all(
        [m.react("✅")].concat(
          users.map((user) => {
            if (user.emoji.charAt(0) === "<") {
              return m.react(
                user.emoji.slice(user.emoji.indexOf(":", 2) + 1, -1)
              );
            } else {
              return m.react(user.emoji);
            }
          }),
          [m.react("❌")]
        )
      ).catch((error) =>
        console.error("One of the emojis failed to react:", error)
      );

      const filter = (reaction, user) => {
        return (
          t[(m.createdAt, authorid)].emojis.includes(reaction.emoji.name) &&
          user.id !== m.author.id
        );
      };

      // collector lasts for 2 minutes before cancelling
      const collector = m.createReactionCollector({
        filter,
        time: 120000,
        dispose: true,
      });

      collector.on("collect", (reaction, user) => {
        if (user.id === authorid) {
          if (reaction.emoji.name === "✅") {
            if (t[(m.createdAt, authorid)].recipients.length == 0) {
              t[(m.createdAt, authorid)].recipients = users;
            }
            if (
              t[(m.createdAt, authorid)].recipients.length == 1 &&
              t[(m.createdAt, authorid)].recipients[0].userid == authorid
            ) {
              t[(m.createdAt, authorid)].status = StatusEnum.CANCELLED;
              transactionInvalid(interaction);
              resolve([0]);
              // cancelled for invalid inputs
              collector.stop();
            } else {
              t[(m.createdAt, authorid)].status = StatusEnum.GOOD;
              confirmTransaction(
                interaction,
                interaction.user.id,
                t[(m.createdAt, authorid)].recipients,
                value,
                description
              );
              resolve(t[(m.createdAt, authorid)].recipients);
              // confirm transaction
              collector.stop();
            }
          } else if (reaction.emoji.name === "❌") {
            t[(m.createdAt, authorid)].status = StatusEnum.CANCELLED;
            transactionCancelled(interaction);
            resolve([0]);
            // cancelled by button
            collector.stop();
          } else {
            users.forEach((u) => {
              if (
                reaction.emoji.name === u.emoji ||
                reaction.emoji.name ===
                  u.emoji.slice(2, u.emoji.indexOf(":", 2))
              ) {
                t[(m.createdAt, authorid)].recipients.push(u);
              }
            });
            newEmbed = new Discord.MessageEmbed()
              .setTitle(`New transaction...`)
              .addFields(
                {
                  name: `Select recipients of this transaction:`,
                  value: strUsers,
                },
                {
                  name: `Current recipients:`,
                  value: getInfoString(
                    t[(m.createdAt, authorid)],
                    users.length
                  ),
                }
              )
              .setFooter(
                `React with ✅ when finished selecting recipients.\nReact with ❌ to cancel this transaction.`
              );
            interaction.editReply({ embeds: [newEmbed] });
          }
        }
      });

      collector.on("remove", (reaction, user) => {
        if (user.id === authorid) {
          users.forEach((u) => {
            if (
              reaction.emoji.name === u.emoji ||
              reaction.emoji.name === u.emoji.slice(2, u.emoji.indexOf(":", 2))
            ) {
              for (
                let i = 0;
                i < t[(m.createdAt, authorid)].recipients.length;
                ++i
              ) {
                if (
                  t[(m.createdAt, authorid)].recipients[i].userid === u.userid
                ) {
                  t[(m.createdAt, authorid)].recipients.splice(i, 1);
                }
              }
            }
          });
          newEmbed = new Discord.MessageEmbed()
            .setTitle(`New transaction...`)
            .addFields(
              {
                name: `Select recipients of this transaction:`,
                value: strUsers,
              },
              {
                name: `Current recipients:`,
                value: getInfoString(t[(m.createdAt, authorid)], users.length),
              }
            )
            .setFooter(
              `React with ✅ when finished selecting recipients.\nReact with ❌ to cancel this transaction.`
            );
          interaction.editReply({ embeds: [newEmbed] });
        }
      });

      collector.on("end", (collected) => {
        m.reactions
          .removeAll()
          .catch((error) =>
            console.error("Failed to clear reactions: ", error)
          );
        if (t[(m.createdAt, authorid)].status == StatusEnum.WORKING) {
          t[(m.createdAt, authorid)].status = StatusEnum.TIMEDOUT;
          transactionTimedOut(interaction);
          resolve([-1]);
          // time ran out
        }
      });
    });
  });
}

function getFormattedUsers(users, userid = null) {
  formUsers = "";
  users.forEach((row) => {
    if (row.userid !== userid) {
      formUsers += `${row.emoji} → `;
      formUsers += `<@!${row.userid}>\n`;
    }
  });
  return formUsers;
}

function getInfoString(info, totalUsers) {
  retStr = "";

  if (info.recipients.length == 0) {
    retStr += `All (default)\n`;
  } else {
    info.recipients.forEach((user) => {
      retStr += `<@!${user.userid}>, `;
    });
    retStr = retStr.slice(0, -2) + `\n`;
  }

  retStr += `Total charge: **₹${parseFloat(info.value).toFixed(2)}**\n`;
  if (info.recipients.length == 0) {
    retStr += `Each charged: **₹${(info.value / totalUsers).toFixed(2)}**\n`;
  } else {
    retStr += `Each charged: **₹${(info.value / info.recipients.length).toFixed(
      2
    )}**\n`;
  }
  if (!info.description) {
    retStr += `**Message:** N/A`;
  } else {
    retStr += `**Message:** ${info.description}`;
  }

  return retStr;
}

function confirmTransaction(
  interaction,
  ownerid,
  recipients,
  value,
  description
) {
  msg = `<@!${ownerid}> purchased **₹${parseFloat(value).toFixed(2)}** for `;
  recipients.forEach((user) => {
    msg += user.emoji;
    msg += `<@!${user.userid}>, `;
  });
  msg = msg.slice(0, -2) + `\n`;
  msg += `→ charging **₹${(value / recipients.length).toFixed(
    2
  )}** to each recipient\n`;
  if (!description) {
    msg += `**Message:** N/A\n`;
  } else {
    msg += `**Message:** ${description}\n`;
  }
  interaction.editReply({
    embeds: [
      {
        title: `Transaction added!`,
        color: 0x00ff00,
        description: msg,
      },
    ],
  });
}

function transactionInvalid(interaction) {
  interaction.editReply({
    embeds: [
      {
        title: `Invalid input. You may not submit a transaction for only yourself.`,
        color: 0xff0000,
      },
    ],
  });
}

function transactionCancelled(interaction) {
  interaction.editReply({
    embeds: [
      {
        title: `Transaction was cancelled.`,
        color: 0xff0000,
      },
    ],
  });
}

function transactionTimedOut(interaction) {
  interaction.editReply({
    embeds: [
      {
        title: `Transaction timed out after 2 minutes.`,
        color: 0xff0000,
      },
    ],
  });
  return;
}
