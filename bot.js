const { Client, Collection, Intents, Permissions } = require("discord.js");
const auth = require("./auth.json");
const fs = require("fs");

const { openDb } = require("./databaseHandler.js");
const { updateLog } = require("./logHandler.js");

let db;

// Initialize Discord Bot
const intents = [
  Intents.FLAGS.GUILDS,
  Intents.FLAGS.GUILD_MEMBERS,
  Intents.FLAGS.GUILD_MESSAGES,
  Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
];
const partials = ["GUILD_MEMBER"];
const client = new Client({
  intents: intents,
  partials: partials,
  disableEveryone: false,
});
client.commands = new Collection();

const commandFiles = fs
  .readdirSync("./commands")
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  // set a new item in the Collection
  // with the key as the command name and the value as the exported module
  client.commands.set(command.data.name, command);
}

client.on("ready", async () => {
  // open database
  db = await openDb();

  // create all the tables if they have not yet been created
  const schema = fs.readFileSync("./database/schema.sql").toString();
  const schemaArr = schema.toString().split(");");

  db.getDatabaseInstance().serialize(() => {
    db.run("PRAGMA foreign_keys=OFF;");
    schemaArr.forEach((query) => {
      if (query) {
        query += ");";
        db.run(query);
      }
    });
  });

  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (!client.commands.has(commandName)) return;

  try {
    await client.commands.get(commandName).execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content:
        "There was an error while executing this command. Please report a bug to the Discord or GitHub if you receive this message.",
      ephemeral: true,
    });
  }
});

client.on("guildCreate", async function (server) {
  sql = `SELECT serverid FROM servers WHERE serverid = ?`;
  existingServer = await db.get(sql, [server.id]);
  if (!existingServer) {
    // add server to the database
    sql = `INSERT INTO servers (serverid, transactionsid, logid, alertsid) 
                        VALUES (?, "", "", "");`;
    db.run(sql, [server.id.toString()]);
  }

  // send initial message
  let defaultChannel = "";
  server.channels.cache.forEach((channel) => {
    if (channel.type == "GUILD_TEXT" && defaultChannel == "") {
      if (
        channel
          .permissionsFor(server.me)
          .has(Permissions.FLAGS.SEND_MESSAGES) &&
        channel.permissionsFor(server.me).has(Permissions.FLAGS.VIEW_CHANNEL)
      ) {
        defaultChannel = channel;
      }
    }
  });
  //defaultChannel will be the channel object that it first finds the bot has permissions for
  defaultChannel.send({
    embeds: [
      {
        title: `Hello! Thanks for adding me! I'm Ledger, a bot designed for tracking finances and is as good as WhatsApp for containing awkwardness. 🐮`,
        thumbnail: {
          url: "https://i.ibb.co/rkTBGVZ/ledger-logo.png",
        },
        color: 0x2471a3,
        description:
          "I use slash commands, so the prefix for all my commands is '/', e.g: '/help'.\nUse the command /help to see a list of all my commands.",
        footer: { text: "Ledger created and developed by chiragnighut05#4977." },
      },
    ],
  });
});

client.on("guildDelete", (server) => {
  //   db.run(`DELETE FROM servers WHERE serverid = ?;`, [server.id]);
});

client.on("emojiDelete", async function (emoji) {
  // see if emoji is connected to a user
  sql = `SELECT userid FROM users WHERE emoji = ? AND serverid = ?`;
  user = await db.get(sql, [`<:${emoji.name}:${emoji.id}>`, emoji.guild.id]);
  if (user) {
    // delete user from the table, add to deleted users
    db.run(`UPDATE users SET status = 0 WHERE userid = ? AND serverid = ?;`, [
      user.userid,
      emoji.guild.id,
    ]).then(() => {
      // update log embed without the user
      updateLog(emoji.guild);
    });

    // send message warning user to re-add the user with a new emoji
    sql = `SELECT alertsid FROM servers WHERE serverid = ?`;
    s = db.run(sql, [emoji.guild.id]);
    defaultChannel = "";
    if (s.alertsids) {
      defaultChannel = emoji.guild.channels.cache.get(s.alertsid);
    } else {
      channel.guild.channels.cache.forEach((channel) => {
        if (channel.type == "GUILD_TEXT" && defaultChannel == "") {
          if (
            channel
              .permissionsFor(channel.guild.me)
              .has(Permissions.FLAGS.SEND_MESSAGES) &&
            channel
              .permissionsFor(channel.guild.me)
              .has(Permissions.FLAGS.VIEW_CHANNEL)
          ) {
            defaultChannel = channel;
          }
        }
      });
    }
    //defaultChannel will be the channel object that it first finds the bot has permissions for
    defaultChannel.send({
      embeds: [
        {
          title: `‼️ WARNING ‼️`,
          color: 0xff0000,
          description: `The emoji previously called :${emoji.name}: was deleted.
            This emoji was connected to <@!${user.userid}>. Please assign a new emoji to <@!${user.userid}>. Until this is done, this user will be removed from the database.`,
        },
      ],
    });
  }
});

client.on("emojiUpdate", async function (oldEmoji, newEmoji) {
  // see if emoji is connected to a user
  sql = `SELECT userid FROM users WHERE emoji = ? AND serverid = ?`;
  user = await db.get(sql, [
    `<:${oldEmoji.name}:${oldEmoji.id}>`,
    oldEmoji.guild.id,
  ]);
  if (user) {
    // update emoji in sql
    db.run(`UPDATE users SET emoji = ? WHERE userid = ? AND serverid = ?;`, [
      `<:${newEmoji.name}:${newEmoji.id}>`,
      user.userid,
      oldEmoji.guild.id,
    ]).then(() => {
      // update log embed
      updateLog(newEmoji.guild);
    });
  }
});

client.on("channelDelete", async function (channel) {
  sql = `SELECT * FROM servers WHERE serverid = ? 
            AND (transactionsid = ? 
              OR logid = ?
              OR alertsid = ?)`;
  s = await db.get(sql, [channel.guild.id, channel.id, channel.id, channel.id]);
  let ch = "";
  if (s) {
    switch (channel.id) {
      case s.transactionsid:
        ch = "transactions";
        db.run(`UPDATE servers SET transactionsid = "" WHERE serverid = ?;`, [
          s.serverid,
        ]);
        break;
      case s.logid:
        ch = "log";
        db.run(`UPDATE servers SET logid = "" WHERE serverid = ?;`, [
          s.serverid,
        ]);
        break;
      case s.alertsid:
        ch = "alerts";
        db.run(`UPDATE servers SET alertsid = "" WHERE serverid = ?;`, [
          s.serverid,
        ]);
        break;
    }

    // send message warning that the channel has been unset
    let defaultChannel = "";
    if (s.alertsid && ch != "alerts") {
      defaultChannel = channel.guild.channels.cache.get(s.alertsid);
    } else {
      channel.guild.channels.cache.forEach((channel) => {
        if (channel.type == "GUILD_TEXT" && defaultChannel == "") {
          if (
            channel
              .permissionsFor(channel.guild.me)
              .has(Permissions.FLAGS.SEND_MESSAGES) &&
            channel
              .permissionsFor(channel.guild.me)
              .has(Permissions.FLAGS.VIEW_CHANNEL)
          ) {
            defaultChannel = channel;
          }
        }
      });
    }

    //defaultChannel will be the channel object that it first finds the bot has permissions for
    defaultChannel.send({
      embeds: [
        {
          title: `‼️ WARNING ‼️`,
          color: 0xff0000,
          description: `The channel previously set as the ${ch} channel has been deleted. This channel has been unset.`,
        },
      ],
    });
  }
});

client.on("channelUpdate", async function (oldChannel, newChannel) {
  // see if channel is assigned
  sql = `SELECT * FROM servers WHERE serverid = ? 
            AND (transactionsid = ? 
              OR logid = ?
              OR alertsid = ?)`;
  s = await db.get(sql, [
    oldChannel.guild.id,
    oldChannel.id,
    oldChannel.id,
    oldChannel.id,
  ]);
  if (s) {
    if (
      newChannel.type !== "GUILD_TEXT" ||
      !newChannel
        .permissionsFor(newChannel.guild.me)
        .has(Permissions.FLAGS.VIEW_CHANNEL) ||
      !newChannel
        .permissionsFor(newChannel.guild.me)
        .has(Permissions.FLAGS.SEND_MESSAGES)
    ) {
      let ch = "";
      switch (oldChannel.id) {
        case s.transactionsid:
          ch = "transactions";
          db.run(`UPDATE servers SET transactionsid = "" WHERE serverid = ?;`, [
            s.serverid,
          ]);
          break;
        case s.logid:
          ch = "log";
          db.run(`UPDATE servers SET logid = "" WHERE serverid = ?;`, [
            s.serverid,
          ]);
          break;
        case s.alertsid:
          ch = "alerts";
          db.run(`UPDATE servers SET alertsid = "" WHERE serverid = ?;`, [
            s.serverid,
          ]);
          break;
      }

      defaultChannel = "";
      // send message warning that the channel has been unset
      if (s.alertsid && ch != "alerts") {
        defaultChannel = oldChannel.guild.channels.cache.get(s.alertsid);
      } else {
        newChannel.guild.channels.cache.forEach((channel) => {
          if (channel.type == "GUILD_TEXT" && defaultChannel == "") {
            if (
              channel
                .permissionsFor(channel.guild.me)
                .has(Permissions.FLAGS.SEND_MESSAGES) &&
              channel
                .permissionsFor(channel.guild.me)
                .has(Permissions.FLAGS.VIEW_CHANNEL)
            ) {
              defaultChannel = channel;
            }
          }
        });
      }

      //defaultChannel will be the channel object that it first finds the bot has permissions for
      defaultChannel.send({
        embeds: [
          {
            title: `‼️ WARNING ‼️`,
            color: 0xff0000,
            description: `The channel previously set as the ${ch} channel has been changed so that Ledger no longer can access it. This channel has been unset.`,
          },
        ],
      });
    }
  }
});

client.on("messageDelete", async function (message) {
  if (message.author.id === client.user.id) {
    sql = `SELECT logembed, logid, alertsid FROM servers WHERE serverid = ?`;
    data = await db.get(sql, [message.guild.id]);
    if (data.logembed === message.id) {
      // send message warning that the channel has been unset
      let defaultChannel = "";
      if (data.alertsid) {
        defaultChannel = message.guild.channels.cache.get(data.alertsid);
      } else {
        message.guild.channels.cache.forEach((channel) => {
          if (channel.type == "GUILD_TEXT" && defaultChannel == "") {
            if (
              channel
                .permissionsFor(channel.guild.me)
                .has(Permissions.FLAGS.SEND_MESSAGES) &&
              channel
                .permissionsFor(channel.guild.me)
                .has(Permissions.FLAGS.VIEW_CHANNEL)
            ) {
              defaultChannel = channel;
            }
          }
        });
      }
      //defaultChannel will be the channel object that it first finds the bot has permissions for
      if (defaultChannel) {
        defaultChannel.send({
          embeds: [
            {
              title: `⚠️ WARNING ⚠️`,
              color: 0xffff00,
              description: `Did you mean to delete the log message? If you wish to unset the log channel, send \`/clearchannel log\`.`,
            },
          ],
        });
      }
      updateLog(message.guild, data.logid);
    }
  }
});

client.on("guildMemberRemove", async function (member) {
  sql = `SELECT userid FROM users WHERE userid = ? AND serverid = ? AND status = 1`;
  user = await db.get(sql, [member.id, member.guild.id]);
  if (user) {
    // delete user from the table, add to deleted users
    db.run(`UPDATE users SET status = 0 WHERE userid = ? AND serverid = ?;`, [
      user.userid,
      member.guild.id,
    ]).then(() => {
      // update log embed without the user
      updateLog(member.guild);
    });

    // send message warning user to re-add the user with a new emoji
    sql = `SELECT alertsid FROM servers WHERE serverid = ?`;
    s = db.run(sql, [member.guild.id]);
    let defaultChannel = "";
    
    if (s.alertsid) {
      defaultChannel = member.guild.channels.cache.get(s.alertsid);
    } else {
      member.guild.channels.cache.forEach((channel) => {
        if (channel.type == "GUILD_TEXT" && defaultChannel == "") {
          if (
            channel
              .permissionsFor(channel.guild.me)
              .has(Permissions.FLAGS.SEND_MESSAGES) &&
            channel
              .permissionsFor(channel.guild.me)
              .has(Permissions.FLAGS.VIEW_CHANNEL)
          ) {
            defaultChannel = channel;
          }
        }
      });
    }

    //defaultChannel will be the channel object that it first finds the bot has permissions for
    defaultChannel.send({
      embeds: [
        {
          title: `‼️ WARNING ‼️`,
          color: 0xff0000,
          description: `The user <@!${member.id}> has left this server. They have been removed from the database.`,
        },
      ],
    });
  }
});

client.login(auth.token);
