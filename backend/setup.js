const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const hash = bcrypt.hashSync(PASSWORD, 12);
const adminFile = path.join(__dirname, 'data/admin.json');
fs.writeFileSync(adminFile, JSON.stringify({ username: 'admin', passwordHash: hash }, null, 2));
console.log(`Admin password set. Login with: admin / ${PASSWORD}`);
