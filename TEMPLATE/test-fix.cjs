const fs = require('fs');
const cheerio = require('cheerio');
const htmlPath = '/Users/reizarachmattullah/Documents/web invitation/TEMPLATE/Scraped_Templates/javanese-serenity/web.menujuacara.id/javanese-serenity/index.html';
const rawHtml = fs.readFileSync(htmlPath, 'utf-8');
const $ = cheerio.load(rawHtml);

const $photo = $('.elementor-element-2bc4d4b5 img');
const $frame = $('.elementor-element-6a774d93 img');
console.log('Photo original attrs:', $photo.attr('width'), $photo.attr('height'), $photo.attr('class'));
console.log('Frame original attrs:', $frame.attr('width'), $frame.attr('height'), $frame.attr('class'));
