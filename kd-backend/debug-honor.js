require('dotenv').config();
const { all } = require('./db-pg');

(async () => {
  const files = await all("SELECT id, name, headers, data FROM honor_files WHERE kingdom_id = 'kdm-1766534804614' ORDER BY fileorder LIMIT 3");
  for (const f of files) {
    console.log('=== File:', f.name, '===');
    if (!f.headers || !f.data) {
      console.log('  NO DATA');
      continue;
    }
    const headers = JSON.parse(f.headers);
    const data = JSON.parse(f.data);
    console.log('  Headers:', headers);
    console.log('  Total rows:', data.length);
    // Find Zyno
    for (const row of data) {
      const rowStr = row.map(String).join('|').toLowerCase();
      if (rowStr.includes('zyno') || rowStr.includes('178913422')) {
        console.log('  Zyno row:', row);
        break;
      }
    }
  }
  process.exit(0);
})();
