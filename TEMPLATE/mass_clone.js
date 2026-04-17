import fs from 'fs';
import path from 'path';
import https from 'https';
import scrape from 'website-scraper';

const BASE_URL = 'https://menujuacara.id/';
const TARGET_DIR = path.resolve('Scraped_Templates');
const RETRY_LIMIT = 3;

const fetchHTML = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
};

const attemptScrape = async (url, destDir, slug, attemptNum = 1) => {
  try {
    console.log(`[Attempt ${attemptNum}] Cloning: ${slug}`);
    const scrapePromise = scrape({
      urls: [url],
      directory: destDir,
      recursive: true,
      maxRecursiveDepth: 1, 
      filenameGenerator: 'bySiteStructure',
      request: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout mutlak 40 detik terpenuhi')), 40000)
    );

    await Promise.race([scrapePromise, timeoutPromise]);
    console.log(`✅ Success: ${slug}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed ${slug}:`, err.message);
    // Bersihkan direktori jika terputus setengah agar bisa retry dari nol
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
    return false;
  }
};

const run = async () => {
  if (!fs.existsSync(TARGET_DIR)) fs.mkdirSync(TARGET_DIR);

  console.log("Fetching homepage for links...");
  const html = await fetchHTML(BASE_URL);
  
  const regex = /href=['"](https:\/\/menujuacara\.id\/[^'"]+)['"]/g;
  const rawLinks = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
      rawLinks.push(match[1]);
  }
  
  const filtered = [...new Set(rawLinks)].filter(l => {
    if (l.includes('wp-content') || l.includes('category') || l.includes('wp-json') || l.includes('xmlrpc') || l.includes('feed')) return false;
    if (l === 'https://menujuacara.id/' || l.includes('tema-gratis')) return false;
    return l.match(/(tema-|eksklusif-|premium-|art-|adat-|custom-|ultah-|sweet-17th|wisuda-|pengukuan-|tasyakuran-|non-wedding|wedding-siri|foto)/i);
  }).sort();

  console.log(`Found ${filtered.length} templates to clone.`);
  fs.writeFileSync(path.join(TARGET_DIR, 'found_links.log'), filtered.join('\n'));

  let failedUrls = [];

  for (let i = 0; i < filtered.length; i++) {
    const url = filtered[i];
    const slug = url.split('/').reverse().find(x => x.trim().length > 0);
    const destDir = path.join(TARGET_DIR, slug);
    
    if (fs.existsSync(destDir)) {
      console.log(`[${i+1}/${filtered.length}] Skipping ${slug}, folder already exists.`);
      continue;
    }

    console.log(`[${i+1}/${filtered.length}] Memproses Antrean...`);
    const success = await attemptScrape(url, destDir, slug, 1);
    if (!success) {
      failedUrls.push({ url, slug, destDir, attempts: 1 });
    }
  }

  // RETRY LOGIC
  if (failedUrls.length > 0) {
    console.log(`\n========================================`);
    console.log(`Ditemukan ${failedUrls.length} kegagalan. Memulai Sesi RETRY...`);
    console.log(`========================================\n`);

    let stillFailed = [];
    for (let failedItem of failedUrls) {
      let solved = false;
      while (failedItem.attempts < RETRY_LIMIT && !solved) {
        failedItem.attempts++;
        console.log(`>>> MENGULANG (${failedItem.attempts}/${RETRY_LIMIT}): ${failedItem.slug}`);
        const success = await attemptScrape(failedItem.url, failedItem.destDir, failedItem.slug, failedItem.attempts);
        if (success) {
          solved = true;
        } else {
            // Beri jeda 3 detik sebelum re-try berikutnya
            await new Promise(r => setTimeout(r, 3000));
        }
      }
      if (!solved) stillFailed.push(failedItem.slug);
    }

    if (stillFailed.length > 0) {
      console.log(`\nPERINGATAN: ${stillFailed.length} template GAGAL PERMANEN setelah ${RETRY_LIMIT}x percobaan:`);
      console.log(stillFailed.join(', '));
    } else {
      console.log(`\nRETRY SUKSES: Semua template bermasalah berhasil diselamatkan!`);
    }
  }

  console.log("\nMass cloning fully complete!");
};

run();
