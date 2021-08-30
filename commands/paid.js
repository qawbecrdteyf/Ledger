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
    .setName("paid")
    .setDescription("Logs a new payment.")
    .addIntegerOption((option) =>
      option
        .setName("cost")
        .setDescription("The total value being paid")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The person being paid")
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    let db = await openDb();
    const cost = interaction.options.getInteger("cost");
    const user = interaction.options.getUser("user");
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
        } else if (!user) {
          // do embed
          sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
          users = await db.all(sql, [interaction.guildId]);
          (async function () {
            handlePayment(
              interaction,
              interaction.user.id,
              users,
              getFormattedUsers(users, interaction.user.id),
              cost
            ).then((recipient) => {
              if (recipient !== 0 && recipient !== -1) {
                sql = `INSERT INTO transactions (serverid, value, description)
                                        VALUES (?, ?, "defaultPaidDescription")`;
                db.run(sql, [interaction.guildId, cost]).then(() => {
                  db.run("SELECT last_insert_rowid()").then((transactionid) => {
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
              }
            });
          })();
        } else {
          // try tagged user
          sql = `SELECT emoji FROM users WHERE userid = ? AND serverid = ? AND status = 1`;
          result = await db.get(sql, [user.id, interaction.guildId]);
          if (!result) {
            interaction.editReply({
              embeds: [
                {
                  description: `<@!${user.id}> is not a registered user. Use /setuser to register a new user.`,
                },
              ],
            });
          } else if (user.id === interaction.user.id) {
            interaction.editReply({
              embeds: [
                {
                  description: `Invalid action: you cannot log a payment to yourself.`,
                },
              ],
            });
          } else {
            let userid = user.id;
            // insert into transactions
            sql = `INSERT INTO transactions (serverid, value, description)
                                VALUES (?, ?, "defaultPaidDescription")`;
            db.run(sql, [interaction.guildId, cost]).then(() => {
              db.run("SELECT last_insert_rowid()").then((transactionid) => {
                sql = `INSERT INTO transactionhands (serverid, transactionid, owner, recipient)
                                        VALUES (?, ?, ?, ?);`;
                db.run(sql, [
                  interaction.guildId,
                  transactionid.lastID,
                  interaction.user.id,
                  userid,
                ]).then(() => {
                  updateLog(interaction.guild);
                });
              });
            });
            confirmPayment(
              interaction,
              interaction.user.id,
              userid,
              result.emoji,
              cost
            );
          }
        }
      } else {
        interaction.editReply({
          embeds: [
            {
              description: `\`/paid\` is a transaction command and can only be used within the set transactions channel, <#${validChannel}>`,
            },
          ],
        });
      }
    }
  },
};

async function handlePayment(interaction, authorid, users, strUsers, value) {
  return new Promise((resolve, reject) => {
    emojis = users.map((user) => {
      if (user.emoji.charAt(0) === "<") {
        return user.emoji.slice(2, user.emoji.indexOf(":", 2));
      } else {
        return `${user.emoji}`;
      }
    });
    emojis.push("❌");

    info = {
      recipient: "",
      value: value,
      emojis: emojis,
      status: StatusEnum.WORKING,
    };

    embed = new Discord.MessageEmbed().setTitle(`New payment...`).addFields({
      name: `Select the recipient of this payment of ₹${parseFloat(
        value
      ).toFixed(2)}:`,
      value: strUsers,
    });
    interaction.editReply({ embeds: [embed] }).then((m) => {
      t[(m.createdAt, authorid)] = info;

      Promise.all(
        users
          .map((user) => {
            if (user.userid != authorid) {
              if (user.emoji.charAt(0) === "<") {
                return m.react(
                  user.emoji.slice(user.emoji.indexOf(":", 2) + 1, -1)
                );
              } else {
                return m.react(user.emoji);
              }
            }
          })
          .concat([m.react("❌")])
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
          if (reaction.emoji.name === "❌") {
            t[(m.createdAt, authorid)].status = StatusEnum.CANCELLED;
            transactionCancelled(interaction);
            resolve(0);
            // cancelled by button
            collector.stop();
          } else {
            users.forEach((u) => {
              if (
                reaction.emoji.name === u.emoji ||
                reaction.emoji.name ===
                  u.emoji.slice(2, u.emoji.indexOf(":", 2))
              ) {
                t[(m.createdAt, authorid)].recipient = u;
                t[(m.createdAt, authorid)].status = StatusEnum.GOOD;
                confirmPayment(interaction, authorid, u.userid, u.emoji, value);
                resolve(u);
                collector.stop();
              }
            });
          }
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
          resolve(-1);
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

function confirmPayment(interaction, ownerid, userid, emoji, value) {
  interaction.editReply({
    embeds: [
      {
        title: `Transaction added!`,
        color: 0x00ff00,
        description: `<@!${ownerid}> paid **₹${parseFloat(value).toFixed(
          2
        )}** to ${emoji}<@!${userid}>`,
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
