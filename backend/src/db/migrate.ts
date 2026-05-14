import fs from 'fs';
import path from 'path';
import { query } from './index';

async function migrate() {
  console.log('Starting migrations...');
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (file.endsWith('.sql')) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await query(sql);
      } catch (err) {
        console.error(`Error in migration ${file}:`, err);
        process.exit(1);
      }
    }
  }

  console.log('Migrations completed successfully!');
  process.exit(0);
}

migrate();
