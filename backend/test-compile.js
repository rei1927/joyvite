const fs = require('fs');
const engine = require('./joyvite-engine.js');
const output = engine.compileTemplate('eksklusif-10-foto', {
  mempelai: { male_name: 'Budi Utomo', female_name: 'Andini Putri', male_nickname: 'Budi', female_nickname: 'Andini' }
});
console.log("Includes Budi Utomo:", output.includes("Budi Utomo"));
console.log("Includes Andini Putri:", output.includes("Andini Putri"));
console.log("Includes Budi & Andini:", output.includes("Budi & Andini"));
console.log("Includes Aria Wicaksono:", output.includes("Aria Wicaksono"));
