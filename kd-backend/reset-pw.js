require('dotenv').config();
const { query, get } = require('./db-pg');
const bcrypt = require('bcryptjs');

(async () => {
  const hash = await bcrypt.hash('test123', 10);
  console.log('New hash:', hash);
  await query('UPDATE users SET password_hash = $1 WHERE username = $2', [hash, 'Zyno']);

  // Verify
  const user = await get('SELECT password_hash FROM users WHERE username = $1', ['Zyno']);
  const match = await bcrypt.compare('test123', user.password_hash);
  console.log('Verification:', match ? 'SUCCESS' : 'FAILED');
  process.exit(0);
})();
