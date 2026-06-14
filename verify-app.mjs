import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:5174';
const screenshots = [];

async function shot(page, name) {
  const path = `/tmp/pw-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  screenshots.push({ name, path });
  console.log(`  📸 ${name} → ${path}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(`CONSOLE ERROR: ${msg.text()}`); });
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

  // 1. Login page
  console.log('\n[1] Login page');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await shot(page, '01-login');
  console.log('  title:', await page.title());
  console.log('  url:', page.url());

  // 2. Try login (mock mode: any credentials work)
  console.log('\n[2] Login with mock credentials');
  const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="mail"]');
  const passInput  = await page.$('input[type="password"]');
  if (emailInput && passInput) {
    await emailInput.fill('test@example.com');
    await passInput.fill('password');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await shot(page, '02-after-login');
    console.log('  url after login:', page.url());
  } else {
    console.log('  ⚠️  Login form inputs not found');
    await shot(page, '02-login-form-missing');
  }

  // 3. Navigate to Projects
  console.log('\n[3] Projects page');
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, '03-projects');

  // 4. Navigate to Dashboard of first project
  console.log('\n[4] Dashboard');
  await page.goto(`${BASE}/projects/1/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, '04-dashboard');

  // 5. Gantt
  console.log('\n[5] Gantt');
  await page.goto(`${BASE}/projects/1/gantt`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, '05-gantt');

  await browser.close();

  console.log('\n=== CONSOLE/PAGE ERRORS ===');
  if (errors.length === 0) console.log('  none');
  else errors.forEach(e => console.log(' ', e));

  console.log('\n=== SCREENSHOTS ===');
  screenshots.forEach(s => console.log(`  ${s.name}: ${s.path}`));
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
