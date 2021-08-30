const { openDb } = require("./databaseHandler.js");

let db;

module.exports = {
  updateLog,
  getLogEmbed,
};

async function updateLog(server, newchannel = "") {
  db = await openDb();
  if (newchannel !== "") {
    c = await server.channels.cache.get(newchannel);
    var e = await getLogEmbed(server);
    c.send({ embeds: [e] }).then((m) => {
      sql = `UPDATE servers SET logembed = ? WHERE serverid = ?;`;
      db.run(sql, [m.id, server.id]);
    });
  } else {
    sql = `SELECT logid, logembed FROM servers WHERE serverid = ?`;
    data = await db.get(sql, [server.id]);
    if (data.logid != "") {
      c = server.channels.cache.get(data.logid);
      c.messages
        .fetch(data.logembed)
        .then((oldEmbed) => {
          (async function () {
            if (!oldEmbed) {
              // in case something breaks in sending the original embed somehow
              embed = await getLogEmbed(server);
              c.send({ embeds: [embed] }).then((m) => {
                sql = `UPDATE servers SET logembed = ? WHERE serverid = ?;`;
                db.run(sql, [m.id, server.id]);
              });
            } else {
              embed = await getLogEmbed(server);
              oldEmbed.edit({ embeds: [embed] });
            }
          })();
        })
        .catch(console.error);
    }
  }
}

async function getLogEmbed(server) {
  db = await openDb();
  return new Promise((resolve, reject) => {
    var log = {};
    // populate the log dictionary with users
    sql = `SELECT userid, emoji FROM users WHERE serverid = ? AND status = 1`;
    db.all(sql, [server.id]).then((users) => {
      if (users.length <= 1) {
        resolve(`No transactions available.`);
      }
      var description = ``;
      users.forEach((user) => {
        description += `<@!${user.userid}>: ${user.emoji}\n`;
        log[user.userid] = {};
        users.forEach((otherUser) => {
          if (otherUser.userid != user.userid) {
            log[user.userid][otherUser.userid] = {
              value: 0,
              emoji: otherUser.emoji,
            };
          }
        });
      });

      var returnEmbed = {};
      returnEmbed.title = "Money log";
      returnEmbed.description = description;
      returnEmbed.color = 0x2471a3;

      // get all transactions and handle them
      sql = `SELECT
                        owner,
                        recipient,
                        value
                    FROM
                        transactions as t 
                        INNER JOIN 
                        transactionhands as th
                        ON t.transactionid = th.transactionid
                    WHERE
                        th.owner != th.recipient
                        AND t.serverid = ?`;
      db.all(sql, [server.id]).then((transactions) => {
        transactions.forEach((t) => {
          if (t.recipient in log) {
            if (t.owner in log[t.recipient]) {
              if (t.value < 0) {
                let leftover = 0;
                log[t.recipient][t.owner].value += t.value;
                leftover = -log[t.recipient][t.owner].value;
                if (leftover > 0) {
                  log[t.owner][t.recipient].value += leftover;
                  log[t.recipient][t.owner].value = 0;
                }
              } else {
                let leftover = 0;
                log[t.owner][t.recipient].value -= t.value;
                leftover = -log[t.owner][t.recipient].value;
                if (leftover > 0) {
                  log[t.recipient][t.owner].value += leftover;
                  log[t.owner][t.recipient].value = 0;
                }
              }
              // if (t.value < 0) { // negative value, due
              //   if (log[t.recipient][t.owner].value > -t.value) {

              //   }
              // } else if (log[t.owner][t.recipient].value > t.value) {
              //   log[t.owner][t.recipient].value -= t.value;
              // } else if (log[t.owner][t.recipient].value > 0) {
              //   log[t.recipient][t.owner].value =
              //     t.value - log[t.owner][t.recipient].value;
              //   log[t.owner][t.recipient].value = 0;
              // } else {
              //   log[t.recipient][t.owner].value += t.value;
              // }
            }
          }
        });

        returnEmbed.fields = [];

        for (user in log) {
          var newField = {
            name: `-----`,
            value: ``,
          };
          var value = `<@!${user}> owes:\n`;

          for (key in log[user]) {
            value += `₹${log[user][key].value.toFixed(2)} to ${
              log[user][key].emoji
            } | `;
          }
          value = value.slice(0, -2) + `\n`;
          newField.value = value;
          returnEmbed.fields.push(newField);
        }

        resolve(returnEmbed);
      });
    });
  });
}
