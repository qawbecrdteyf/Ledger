const sqlite3 = require("sqlite3").verbose();
const sqlite = require("sqlite");
const open = sqlite.open;

// you would have to import / invoke this in another file
module.exports = {
  openDb: async () => {
    return open({
      filename: "./database/database.db",
      driver: sqlite3.Database,
    });
  },
};
