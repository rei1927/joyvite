import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const oldPath = path.join(__dirname, 'Scraped_Templates', 'javanese-serenity', 'web.menujuacara.id');
const newPath = path.join(__dirname, 'Scraped_Templates', 'javanese-serenity', 'menujuacara.id');

if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log('Renamed web.menujuacara.id to menujuacara.id');
} else {
    console.log('Folder web.menujuacara.id not found');
}
