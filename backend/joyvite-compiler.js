const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Mock Data dari Dashboard Joyvite
const formData = {
    male_name: "Reiza Rachmattullah",
    male_nickname: "Rei",
    female_name: "Amanda Rawles",
    female_nickname: "Amanda",
    event_date_primary: "Minggu, 12 Desember 2030",
    venue_primary: "Hotel Mulia Senayan",
    address_primary: "Jl. Asia Afrika Senayan, Jakarta"
};

// Target file
const templateDir = path.resolve(__dirname, '../TEMPLATE/Scraped_Templates/eksklusif-1-tanpa-foto-2/menujuacara.id/eksklusif-1-tanpa-foto-2/');
const targetFile = path.join(templateDir, 'index.html');
const outputFile = path.join(templateDir, 'index_dynamic.html');

console.log("Membaca template mentah: ", targetFile);

try {
    const rawHtml = fs.readFileSync(targetFile, 'utf-8');
    const $ = cheerio.load(rawHtml);

    // MENGGANTI NAMA MEMPELAI
    // Rata-rata template (seperti eksklusif-1) mencantumkan "Nama Pria & Nama Wanita" atau "Pria & Wanita"
    // Kita lakukan generic regex replace di seluruh text node
    
    let htmlContent = $.html();
    
    // Replace logic cerdas (hanya contoh text node Elementor)
    htmlContent = htmlContent.replace(/Nama Pria/gi, formData.male_name);
    htmlContent = htmlContent.replace(/Nama Wanita/gi, formData.female_name);
    htmlContent = htmlContent.replace(/Pria/g, formData.male_nickname);
    htmlContent = htmlContent.replace(/Wanita/g, formData.female_nickname);

    // Anda bisa mentarget class dengan Cheerio juga:
    // $('.elementor-heading-title').each(function() {
    //      if($(this).text().includes('Resepsi')) { ... }
    // });
    
    fs.writeFileSync(outputFile, htmlContent);
    console.log("SUKSES: Template statis berhasil disulap menjadi templat dinamis!");
    console.log("File Tersimpan di: ", outputFile);

} catch (err) {
    console.error("Gagal membaca atau memproses template: ", err.message);
}
