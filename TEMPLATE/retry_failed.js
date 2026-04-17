import fs from 'fs';
import path from 'path';
import scrape from 'website-scraper';

const TARGET_DIR = path.resolve('Scraped_Templates');
const TIMEOUT_MS = 20000;
const MAX_RETRIES = 3;

const FAILED_TEMPLATES = [
  'tema-15-tanpa-foto',
  'tema-24-tanpa-foto',
  'tema-adat-aceh',
  'tema-adat-bali-tanpa-foto',
  'tema-adat-bugis-tanpa-foto',
  'tema-adat-bugis',
  'tema-adat-toraja-tanpa-foto',
  'tema-chinese-foto',
  'tema-chinese-tanpa-foto',
  'tema-natal-merah',
  'tema-natal-putih',
  'ultah-balon-biru',
  'ultah-black-and-gold-theme',
  'ultah-frozen-theme',
  'ultah-red-and-black-theme',
  'ultah-tema-hello-kitty',
  'ultah-tema-kastil-pink',
  'ultah-tema-laut',
  'wedding-tema-one-piece',
  'wedding-tema-tionghoa-foto',
  'wedding-tema-tionghoa',
  'wisuda-1',
  'wisuda-2',
  'wisuda-3',
  'wisuda-4',
];

const cleanDir = (dir) => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    const start = Date.now();
    while (fs.existsSync(dir) && Date.now() - start < 2000) {}
  }
};

const attemptScrape = async (slug) => {
  const url = `https://menujuacara.id/${slug}/`;
  const destDir = path.join(TARGET_DIR, slug);

  cleanDir(destDir);

  try {
    const scrapePromise = scrape({
      urls: [url],
      directory: destDir,
      recursive: false,           // Tidak recursive agar tidak mengejar link CDN panjang
      maxRecursiveDepth: 0,
      filenameGenerator: 'bySiteStructure',
      urlFilter: (filterUrl) => {
        // Hanya izinkan aset dari domain asli + CDN yang relevan
        // Blokir domain Lazada, Instagram embed, WhatsApp, Google Tag dsb
        if (filterUrl.includes('lazcdn.com')) return false;
        if (filterUrl.includes('lazada.co.id')) return false;
        if (filterUrl.includes('googletagmanager.com')) return false;
        if (filterUrl.includes('facebook.com')) return false;
        if (filterUrl.includes('instagram.com')) return false;
        if (filterUrl.includes('whatsapp.com')) return false;
        if (filterUrl.includes('whatsapp.net')) return false;
        return true;
      },
      request: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout 20 detik')), TIMEOUT_MS)
    );

    await Promise.race([scrapePromise, timeoutPromise]);
    console.log(`✅ [${slug}] Berhasil!`);
    return true;
  } catch (err) {
    console.error(`❌ [${slug}] Gagal: ${err.message}`);
    cleanDir(destDir);
    return false;
  }
};

const run = async () => {
  console.log('========================================');
  console.log(' RETRY KHUSUS 25 TEMPLATE GAGAL');
  console.log(` Timeout: ${TIMEOUT_MS / 1000}s | Max Retry: ${MAX_RETRIES}x`);
  console.log(' Fix: Non-recursive + URL Filter');
  console.log('========================================\n');

  const stillFailed = [];

  for (let i = 0; i < FAILED_TEMPLATES.length; i++) {
    const slug = FAILED_TEMPLATES[i];
    console.log(`\n[${i + 1}/${FAILED_TEMPLATES.length}] >>> ${slug}`);

    let success = false;
    for (let attempt = 1; attempt <= MAX_RETRIES && !success; attempt++) {
      console.log(`  Percobaan ke-${attempt}...`);
      success = await attemptScrape(slug);
      if (!success && attempt < MAX_RETRIES) {
        console.log(`  Jeda 3 detik...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    if (!success) {
      stillFailed.push(slug);
    }
  }

  console.log('\n========================================');
  console.log(' LAPORAN AKHIR');
  console.log('========================================');
  const rescued = FAILED_TEMPLATES.length - stillFailed.length;
  console.log(`Berhasil: ${rescued}/${FAILED_TEMPLATES.length}`);
  if (stillFailed.length > 0) {
    console.log(`Masih gagal (${stillFailed.length}):`);
    stillFailed.forEach(s => console.log(`  - ${s}`));
  } else {
    console.log('SEMPURNA! Semua 25 template berhasil dikloning! 🎉');
  }
};

run();
