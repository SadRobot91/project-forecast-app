import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/project_forecast',
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
