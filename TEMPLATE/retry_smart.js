import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const TARGET_DIR = path.resolve('Scraped_Templates');
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

// Domain yang diizinkan untuk download aset
const ALLOWED_DOMAINS = [
  'menujuacara.id',
  'kipainvitation.com',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

const BLOCKED_DOMAINS = [
  'lazcdn.com', 'lazada.co.id', 'googletagmanager.com',
  'facebook.com', 'instagram.com', 'whatsapp.com', 'whatsapp.net',
  'google-analytics.com', 'doubleclick.net', 'googlesyndication.com',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function fetchUrl(url, isBinary = false) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout 15s')), 15000);
    const proto = url.startsWith('https') ? https : http;
    
    const req = proto.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      // Handle redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timeout);
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const u = new URL(url);
          redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
        }
        return fetchUrl(redirectUrl, isBinary).then(resolve).catch(reject);
      }
      
      if (res.statusCode !== 200) {
        clearTimeout(timeout);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      if (isBinary) {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => { clearTimeout(timeout); resolve(Buffer.concat(chunks)); });
      } else {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => { clearTimeout(timeout); resolve(data); });
      }
    });
    req.on('error', (e) => { clearTimeout(timeout); reject(e); });
    req.on('timeout', () => { req.destroy(); clearTimeout(timeout); reject(new Error('Socket timeout')); });
  });
}

function isAllowedDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    if (BLOCKED_DOMAINS.some(d => hostname.includes(d))) return false;
    if (ALLOWED_DOMAINS.some(d => hostname.includes(d))) return true;
    return false;
  } catch { return false; }
}

function extractAssetUrls(html, baseUrl) {
  const urls = new Set();
  // CSS files
  const cssRe = /href=["']([^"']+\.css[^"']*)/gi;
  // JS files
  const jsRe = /src=["']([^"']+\.js[^"']*)/gi;
  // Images
  const imgRe = /(?:src|data-src|data-lazy-src)=["']([^"']+\.(png|jpg|jpeg|gif|svg|webp|ico)[^"']*)/gi;
  // Fonts & other url() in inline styles
  const urlRe = /url\(["']?([^"')]+)["']?\)/gi;
  
  for (const re of [cssRe, jsRe, imgRe, urlRe]) {
    let m;
    while ((m = re.exec(html)) !== null) {
      let assetUrl = m[1];
      if (assetUrl.startsWith('//')) assetUrl = 'https:' + assetUrl;
      else if (assetUrl.startsWith('/')) {
        const u = new URL(baseUrl);
        assetUrl = `${u.protocol}//${u.host}${assetUrl}`;
      } else if (!assetUrl.startsWith('http')) {
        assetUrl = new URL(assetUrl, baseUrl).href;
      }
      if (isAllowedDomain(assetUrl)) urls.add(assetUrl);
    }
  }
  return [...urls];
}

function urlToLocalPath(assetUrl, slug) {
  try {
    const u = new URL(assetUrl);
    let filePath = u.hostname + u.pathname;
    // Potong query string & bersihkan karakter ilegal
    filePath = filePath.split('?')[0].replace(/[<>:"|?*]/g, '_');
    // Batasi panjang path per segment agar tidak ENAMETOOLONG
    const segments = filePath.split('/');
    const safeSegments = segments.map(s => s.length > 100 ? s.substring(0, 100) : s);
    return path.join(TARGET_DIR, slug, ...safeSegments);
  } catch {
    return null;
  }
}

async function cloneTemplate(slug) {
  const url = `https://menujuacara.id/${slug}/`;
  const destDir = path.join(TARGET_DIR, slug);
  
  // Bersihkan
  if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });

  console.log(`  Mengunduh HTML utama...`);
  const html = await fetchUrl(url);

  // Simpan HTML utama
  const htmlDir = path.join(destDir, 'menujuacara.id', slug);
  fs.mkdirSync(htmlDir, { recursive: true });
  fs.writeFileSync(path.join(htmlDir, 'index.html'), html);

  // Ekstrak & unduh aset
  const assetUrls = extractAssetUrls(html, url);
  console.log(`  Ditemukan ${assetUrls.length} aset untuk diunduh...`);

  let downloaded = 0;
  let failed = 0;

  for (const assetUrl of assetUrls) {
    const localPath = urlToLocalPath(assetUrl, slug);
    if (!localPath) { failed++; continue; }
    
    // Skip jika sudah ada
    if (fs.existsSync(localPath)) { downloaded++; continue; }

    try {
      const data = await fetchUrl(assetUrl, true);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, data);
      downloaded++;
    } catch {
      failed++;
    }
  }

  console.log(`  Aset: ${downloaded} berhasil, ${failed} gagal/dilewati`);
  return true;
}

async function run() {
  console.log('========================================');
  console.log(' SMART RETRY - Custom Scraper');
  console.log(' Tanpa website-scraper, tanpa wget');
  console.log(`  Target: ${FAILED_TEMPLATES.length} template`);
  console.log('========================================\n');

  const stillFailed = [];

  for (let i = 0; i < FAILED_TEMPLATES.length; i++) {
    const slug = FAILED_TEMPLATES[i];
    console.log(`\n[${i + 1}/${FAILED_TEMPLATES.length}] >>> ${slug}`);

    let success = false;
    for (let attempt = 1; attempt <= MAX_RETRIES && !success; attempt++) {
      console.log(`  Percobaan ke-${attempt}...`);
      try {
        await cloneTemplate(slug);
        console.log(`  ✅ Berhasil: ${slug}`);
        success = true;
      } catch (err) {
        console.error(`  ❌ Gagal: ${err.message}`);
        const destDir = path.join(TARGET_DIR, slug);
        if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
        if (attempt < MAX_RETRIES) {
          console.log(`  Jeda 3 detik...`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    if (!success) stillFailed.push(slug);
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
}

run();
