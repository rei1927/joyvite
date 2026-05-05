const fs = require('fs');
const engine = require('./backend/joyvite-engine.js');
const output = engine.compileTemplate('eksklusif-10-foto', {
  mempelai: { male_name: 'Budi Utomo', female_name: 'Andini Putri', male_nickname: 'Budi', female_nickname: 'Andini' },
  additionalSettings: { posisi_nama: 'pria_wanita' }
});

console.log("-------------------");
console.log("Includes Budi Utomo:", output.includes("Budi Utomo"));
console.log("Includes Andini Putri:", output.includes("Andini Putri"));
console.log("Includes Budi & Andini:", output.includes("Budi & Andini"));
console.log("-------------------");
// Find lines with elementor-heading-title
const lines = output.split('\n');
const headings = lines.filter(l => l.includes('elementor-heading-title')).slice(0, 5);
headings.forEach(l => console.log(l));
