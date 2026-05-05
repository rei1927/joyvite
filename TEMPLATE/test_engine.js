const {compileTemplate} = require('./joyvite-engine');
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();

p.weddingConfig.findUnique({where:{slug:'budi-andini'}}).then(c => {
  if(!c) { console.log('NOT FOUND'); process.exit(1); }
  const html = compileTemplate(c.template, c.settings||{});
  
  // Check for broken url() references still pointing to relative paths
  const brokenUrl = (html.match(/url\(\.\.\//g) || []).length;
  const brokenSrc = (html.match(/(src|href)=["']\.\.\/wp/g) || []).length;
  const brokenCdn = (html.match(/(src|href)=["']\.\.\/\.\.\//g) || []).length;
  const goodUrl = (html.match(/menujuacara\.id/g) || []).length;
  
  console.log('=== JOYVITE ENGINE DIAGNOSTIC ===');
  console.log('Total HTML length:', html.length);
  console.log('Good menujuacara.id refs:', goodUrl);
  console.log('Broken url(..) refs:', brokenUrl);  
  console.log('Broken src/href ../wp refs:', brokenSrc);
  console.log('Broken CDN ../../ refs:', brokenCdn);
  console.log('');
  
  // Show all still-broken relative paths
  const allBroken = html.match(/(url\(|src="|href=")\.\.\/[^"')]+/g);
  if (allBroken && allBroken.length > 0) {
    console.log('=== STILL BROKEN PATHS ===');
    allBroken.forEach((m,i) => console.log(`  ${i+1}. ${m.substring(0,120)}`));
  } else {
    console.log('No broken relative paths found - all rewritten OK!');
  }
  
  p.$disconnect();
}).catch(e => { console.error(e); p.$disconnect(); });
