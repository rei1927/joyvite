const fs = require('fs');
const cheerio = require('../backend/node_modules/cheerio');
const html = fs.readFileSync('Scraped_Templates/javanese-serenity/web.menujuacara.id/javanese-serenity/index.html', 'utf8');
const $ = cheerio.load(html);

let foundCover = false;
$('img').each(function() {
    const src = $(this).attr('src') || '';
    const lowerSrc = src.toLowerCase();
    
    if (!foundCover && !lowerSrc.includes('bunga') && !lowerSrc.includes('flower') && 
        !lowerSrc.includes('daun') && !lowerSrc.includes('leaf') &&
        !lowerSrc.includes('ornament') && !lowerSrc.includes('ornamen') &&
        !lowerSrc.includes('bg') && !lowerSrc.includes('background') &&
        !lowerSrc.includes('shape') && !lowerSrc.includes('mask') &&
        !lowerSrc.includes('animasi') && !lowerSrc.includes('bingkai') &&
        !lowerSrc.includes('wreath') && !lowerSrc.includes('frame') &&
        !lowerSrc.includes('border') && !lowerSrc.includes('gunungan') &&
        !lowerSrc.includes('wayang') && !lowerSrc.includes('pohon') &&
        !lowerSrc.includes('semak') && !lowerSrc.includes('tato') &&
        !lowerSrc.includes('texture') && !lowerSrc.includes('pattern') &&
        !lowerSrc.includes('awan') && !lowerSrc.includes('cloud') &&
        !lowerSrc.includes('burung') && !lowerSrc.includes('bird')) {
        
        console.log('FOUND COVER:', src);
        foundCover = true;
    }
});
