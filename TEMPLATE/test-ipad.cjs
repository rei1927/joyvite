const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 768, height: 1024 });
  await page.goto('https://web.menujuacara.id/javanese-serenity', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: '/Users/reizarachmattullah/Documents/web invitation/TEMPLATE/ipad-original.png' });
  await browser.close();
  console.log('Done');
})();
