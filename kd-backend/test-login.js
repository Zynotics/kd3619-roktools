require('dotenv').config();
const { get, getActiveR5Access } = require('./db-pg');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const user = await get('SELECT *, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files, can_manage_analytics_files, can_access_kvk_manager, can_access_migration_list FROM users WHERE username = $1', ['Zyno']);
    console.log('User found:', !!user);
    console.log('Role:', user.role);
    console.log('Hash starts with:', user.password_hash.substring(0, 10));

    console.log('\nTesting getActiveR5Access...');
    const r5 = await getActiveR5Access(user.id);
    console.log('R5 access:', r5);

    console.log('\nTesting bcrypt compare...');
    const match = await bcrypt.compare('test123', user.password_hash);
    console.log('Password match:', match);
  } catch (err) {
    console.error('ERROR:', err.message);
  }
  process.exit(0);
})();
