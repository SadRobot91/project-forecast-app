import fs from 'fs';
import path from 'path';
import { query } from './index';

async function migrate() {
  console.log('Starting migrations...');
  
  // Ensure migrations table exists
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (file.endsWith('.sql')) {
      // Check if already executed
      const result = await query('SELECT * FROM migrations WHERE name = $1', [file]);
      if (result.rows.length > 0) {
        console.log(`Skipping already executed migration: ${file}`);
        continue;
      }

      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      try {
        await query(sql);
        await query('INSERT INTO migrations (name) VALUES ($1)', [file]);
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
