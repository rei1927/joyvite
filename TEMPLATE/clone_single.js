import fs from 'fs';
import path from 'path';
import scrape from 'website-scraper';

const url = 'https://web.menujuacara.id/javanese-serenity/';
const slug = 'javanese-serenity';
const TARGET_DIR = path.resolve('Scraped_Templates', slug);

const attemptScrape = async () => {
  try {
    if (fs.existsSync(TARGET_DIR)) {
      console.log(`Directory ${TARGET_DIR} already exists. Removing it first...`);
      fs.rmSync(TARGET_DIR, { recursive: true, force: true });
    }
    
    console.log(`Cloning: ${slug} from ${url}`);
    await scrape({
      urls: [url],
      directory: TARGET_DIR,
      recursive: true,
      maxRecursiveDepth: 1, 
      filenameGenerator: 'bySiteStructure',
      request: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    });
    console.log(`✅ Success: ${slug}`);
  } catch (err) {
    console.error(`❌ Failed ${slug}:`, err.message);
  }
};

attemptScrape();
