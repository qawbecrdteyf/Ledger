const { openDb } = require("./databaseHandler.js");

module.exports = {
  checkValidUser,
  checkTransactionsChannel,
};

async function checkValidUser(interaction) {
  let userid = interaction.user.id;
  let serverid = interaction.guildId;
  let db = await openDb();
  return new Promise((resolve, reject) => {
    sql = `SELECT userid FROM users WHERE userid = ? AND serverid = ? AND status = 1`;
    db.get(sql, [userid, serverid]).then((val) => {
      if (val) {
        resolve(true);
      } else {
        sql = `SELECT userid FROM users WHERE serverid = ? AND status = 1`;
        db.get(sql, [serverid]).then((users) => {
          if (!users) {
            interaction.editReply({
              embeds: [
                {
                  description: `No users are set. Set up users using \`/setUser [@user] [emoji]\`.`,
                },
              ],
            });
          } else {
            interaction.editReply({
              embeds: [
                {
                  description: `This command may only be used by registered users. Use /setuser to register a new user.`,
                },
              ],
            });
          }
          resolve(false);
        });
      }
    });
  });
}

async function checkTransactionsChannel(channelid, serverid) {
  let db = await openDb();
  return new Promise((resolve, reject) => {
    sql = `SELECT transactionsid FROM servers WHERE serverid = ?`;
    db.get(sql, [serverid]).then((data) => {
      if (data.transactionsid == "" || data.transactionsid == channelid) {
        resolve(null);
      } else {
        resolve(data.transactionsid);
      }
    });
  });
}
