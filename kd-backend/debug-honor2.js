require('dotenv').config();
const { all } = require('./db-pg');

(async () => {
  const files = await all("SELECT id, name, headers, data FROM honor_files WHERE kingdom_id = 'kdm-1766534804614' ORDER BY fileorder LIMIT 5");
  console.log('Zyno honor per snapshot:');
  for (const f of files) {
    if (!f.headers || !f.data) { console.log(f.name, '-> NO DATA'); continue; }
    const data = JSON.parse(f.data);
    for (const row of data) {
      const rowStr = row.map(String).join('|').toLowerCase();
      if (rowStr.includes('zyno') || rowStr.includes('178913422')) {
        console.log(`  ${f.name} -> row length: ${row.length}, values: [${row.join(', ')}]`);
        break;
      }
    }
  }
  process.exit(0);
})();
