CREATE TABLE IF NOT EXISTS servers(
    serverid TEXT PRIMARY KEY,
    transactionsid TEXT,
    logid TEXT,
    alertsid TEXT,
    logembed TEXT
);

CREATE TABLE IF NOT EXISTS users(
    serverid TEXT NOT NULL,
    userid TEXT NOT NULL,
    emoji TEXT NOT NULL,
    status INTEGER NOT NULL,
    FOREIGN KEY (serverid) REFERENCES servers(serverid) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (serverid, userid)
);

CREATE TABLE IF NOT EXISTS transactions(
    serverid TEXT NOT NULL,
    transactionid INTEGER NOT NULL,
    value REAL NOT NULL,
    description TEXT,
    created DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (serverid) REFERENCES servers(serverid) ON UPDATE CASCADE ON DELETE CASCADE
    PRIMARY KEY (transactionid)
);

CREATE TABLE IF NOT EXISTS transactionhands(
    serverid TEXT NOT NULL,
    transactionid INTEGER NOT NULL,
    owner TEXT NOT NULL,
    recipient TEXT NOT NULL,
    FOREIGN KEY (serverid) REFERENCES servers(serverid) ON UPDATE CASCADE ON DELETE CASCADE
    FOREIGN KEY (transactionid) REFERENCES transactions(transactionid) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reminders(
    serverid TEXT NOT NULL,
    message TEXT NOT NULL,
    time DATETIME NOT NULL,
    FOREIGN KEY (serverid) REFERENCES servers(serverid) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shoppinglists(
    serverid TEXT NOT NULL,
    item TEXT NOT NULL,
    ownerid TEXT NOT NULL,
    FOREIGN KEY (serverid) REFERENCES servers(serverid) ON UPDATE CASCADE ON DELETE CASCADE
);