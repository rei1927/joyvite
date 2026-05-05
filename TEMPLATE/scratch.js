const cheerio = require('cheerio');
const html = '<h2 class="elementor-heading-title elementor-size-default">Yori &amp; Aria</h2><h2 class="elementor-heading-title elementor-size-default">Aria Wicaksono</h2>';
const $ = cheerio.load(html);

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceHeadingText($, oldText, newText) {
  if (!newText) return;
  let replaced = false;
  $('.elementor-heading-title').each(function () {
    const el = $(this);
    const text = el.text().trim();
    const rawHtml = el.html();
    console.log(`Checking text: "${text}" against oldText: "${oldText}"`);
    console.log(`Checking HTML: "${rawHtml}" against oldText: "${oldText}"\n`);
    
    if (text === oldText) {
      el.text(newText);
      replaced = true;
      console.log('REPLACED VIA TEXT MATCH!');
    } else if (rawHtml && rawHtml.includes(oldText)) {
      el.html(rawHtml.replace(oldText, newText));
      replaced = true;
      console.log('REPLACED VIA HTML MATCH!');
    }
  });
  return replaced;
}

const mempelai = { female_nickname: 'Andini', male_nickname: 'Budi' };
const isPriaWanita = true;
const coverName = isPriaWanita 
  ? `${mempelai.male_nickname} & ${mempelai.female_nickname}`
  : `${mempelai.female_nickname} & ${mempelai.male_nickname}`;

// TARGET 2 Logic:
$('.elementor-heading-title').each(function () {
  const text = $(this).text().trim();
  console.log(`Target 2 Text: "${text}"`);
  if (text.match(/^.+\s*[&]\s*.+$/) && !text.includes(',') && text.length < 40) {
    $(this).text(coverName);
    console.log('TARGET 2 REPLACED COVER NAME!');
  }
});

replaceHeadingText($, 'Aria Wicaksono', 'Budi Utomo');

console.log('FINAL HTML:', $.html());
