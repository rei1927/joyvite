/**
 * JOYVITE DOM ENGINE (SSR Template Compiler)
 * 
 * Mesin inti yang menghubungkan data form Joyvite dengan 133 template statis.
 * Menggunakan Cheerio untuk memanipulasi DOM secara server-side.
 * 
 * Flow:
 * 1. Menerima slug template + data settings JSON dari database
 * 2. Membaca file index.html template mentah
 * 3. Menggunakan Cheerio untuk replace semua placeholder text & gambar
 * 4. Mengembalikan HTML final yang sudah terisi data customer
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const TEMPLATES_DIR = process.env.TEMPLATES_DIR || path.resolve(__dirname, '../TEMPLATE/Scraped_Templates');

/**
 * Mencari file index.html di dalam folder template.
 * Struktur folder bisa bervariasi: langsung di root atau di subfolder menujuacara.id/slug/
 */
function findTemplateHtml(templateSlug) {
  const baseDir = path.join(TEMPLATES_DIR, templateSlug);
  
  // Cek path langsung
  const directPath = path.join(baseDir, 'index.html');
  if (fs.existsSync(directPath)) return directPath;

  // Cek path struktur website-scraper: menujuacara.id/slug/index.html
  const scraperPath = path.join(baseDir, 'menujuacara.id', templateSlug, 'index.html');
  if (fs.existsSync(scraperPath)) return scraperPath;

  // Cek semua subfolder untuk index.html
  const subDirs = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  
  for (const sub of subDirs) {
    const subPath = path.join(baseDir, sub, templateSlug, 'index.html');
    if (fs.existsSync(subPath)) return subPath;
    
    const subDirect = path.join(baseDir, sub, 'index.html');
    if (fs.existsSync(subDirect)) return subDirect;
  }

  throw new Error(`Template HTML not found for: ${templateSlug}`);
}

/**
 * Mengganti teks pada elemen .elementor-heading-title yang mengandung teks target.
 */
function replaceHeadingText($, oldText, newText) {
  if (!newText) return;
  let replaced = false;
  $('.elementor-heading-title').each(function () {
    const el = $(this);
    const text = el.text().trim();
    const html = el.html();
    // Match lewat text() untuk kecocokan yang lebih akurat
    if (text === oldText) {
      el.text(newText);
      replaced = true;
    } else if (html && html.includes(oldText)) {
      el.html(html.replace(oldText, newText));
      replaced = true;
    }
  });
  return replaced;
}

/**
 * Mengganti teks secara global di seluruh HTML (fallback jika class tidak ditemukan)
 */
function replaceGlobalText(htmlContent, oldText, newText) {
  if (!newText || !oldText) return htmlContent;
  // Gunakan regex case-insensitive untuk menemukan placeholder
  const regex = new RegExp(escapeRegex(oldText), 'gi');
  return htmlContent.replace(regex, newText);
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * MAIN COMPILER FUNCTION
 * Menerima slug template dan data settings, mengembalikan HTML final.
 */
function compileTemplate(templateSlug, settings) {
  const htmlPath = findTemplateHtml(templateSlug);
  let rawHtml = fs.readFileSync(htmlPath, 'utf-8');
  const $ = cheerio.load(rawHtml);

  const mempelai = settings.mempelai || {};
  const events = settings.events || [];
  const quotes = settings.quotes || {};
  const judul = settings.judul || {};
  const amplop = settings.amplop || {};
  const livestream = settings.livestream || {};

  // =========================================
  // 1. INJEKSI WAKTU & LOKASI ACARA (HARUS DULUAN)
  // Agar teks "Kediaman Mempelai Wanita/Pria" belum terusik
  // oleh replacement kata "Mempelai" di blok orang tua
  // =========================================
  
  if (events.length > 0) {
    const primaryEvent = events[0];
    const secondaryEvent = events.length > 1 ? events[1] : null;

    // Lokasi - REPLACE INI DULU sebelum yang lain
    if (primaryEvent.place_name) {
      replaceHeadingText($, 'Kediaman Mempelai Wanita', primaryEvent.place_name);
    }
    if (secondaryEvent && secondaryEvent.place_name) {
      replaceHeadingText($, 'Kediaman Mempelai Pria', secondaryEvent.place_name);
    }

    // Tanggal (format: "Rabu, 15 Juli 2026")
    if (primaryEvent.date) {
      const dateStr = formatIndonesianDate(primaryEvent.date);
      $('.elementor-heading-title').each(function () {
        const text = $(this).text().trim();
        if (text.match(/^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu),?\s+\d+/i)) {
          $(this).text(dateStr);
        }
      });
    }

    // Jam acara
    if (primaryEvent.time_start) {
      replaceHeadingText($, 'Pukul 08.00 WIB', `Pukul ${primaryEvent.time_start} WIB`);
    }
    if (secondaryEvent && secondaryEvent.time_start) {
      const timeText = secondaryEvent.until_finish 
        ? `Pukul ${secondaryEvent.time_start} WIB - Selesai`
        : `Pukul ${secondaryEvent.time_start} WIB`;
      replaceHeadingText($, 'Pukul 10.00 WIB - Selesai', timeText);
    }

    // Update countdown date
    if (primaryEvent.date) {
      $('[data-date]').attr('data-date', formatCountdownDate(primaryEvent.date));
      const day = new Date(primaryEvent.date).getDate();
      $('[data-to-value]').each(function() {
        const currentVal = $(this).attr('data-to-value');
        if (parseInt(currentVal) <= 31) {
          $(this).attr('data-to-value', day.toString());
        }
      });
    }

    // Google Maps iframe
    if (primaryEvent.gmaps) {
      $('iframe[src*="maps.google"]').attr('src', primaryEvent.gmaps);
    }
  }

  // =========================================
  // 2. INJEKSI NAMA MEMPELAI
  // =========================================
  
  // Nama panggilan di cover (biasanya format: "Haqi & Dewi")
  if (mempelai.male_nickname && mempelai.female_nickname) {
    $('.elementor-heading-title').each(function () {
      const text = $(this).text().trim();
      if (text === '&' || text === '&amp;') return;
    });
  }

  // Ganti nama mempelai di bagian "TENTANG KAMI"
  let mempelaiCount = 0;
  $('.elementor-heading-title').each(function () {
    const text = $(this).text().trim();
    if (text === 'Nama Mempelai') {
      mempelaiCount++;
      if (mempelaiCount === 1 && mempelai.male_name) {
        $(this).text(mempelai.male_name);
      } else if (mempelaiCount === 2 && mempelai.female_name) {
        $(this).text(mempelai.female_name);
      }
    }
  });

  // Ganti nama panggilan di cover
  const defaultMaleNames = ['Haqi', 'Pria', 'Nama Panggilan Pria', 'Romeo'];
  const defaultFemaleNames = ['Dewi', 'Wanita', 'Nama Panggilan Wanita', 'Juliet'];
  
  if (mempelai.male_nickname) {
    defaultMaleNames.forEach(name => {
      replaceHeadingText($, name, mempelai.male_nickname);
    });
  }
  if (mempelai.female_nickname) {
    defaultFemaleNames.forEach(name => {
      replaceHeadingText($, name, mempelai.female_nickname);
    });
  }

  // Ganti info orang tua
  $('.elementor-heading-title').each(function () {
    let html = $(this).html();
    if (!html) return;

    if (html.includes('Bpk. Mempelai') && html.includes('Ibu Mempelai')) {
      if (mempelai.male_father_name) {
        html = html.replace(/Bpk\. Mempelai/g, mempelai.male_father_name);
      }
      if (mempelai.male_mother_name) {
        html = html.replace(/Ibu Mempelai/g, mempelai.male_mother_name);
      }
      if (mempelai.male_family_sequence && html.includes('Putra Pertama')) {
        html = html.replace('Putra Pertama', mempelai.male_family_sequence);
      }
      if (mempelai.female_family_sequence && html.includes('Putri Pertama')) {
        html = html.replace('Putri Pertama', mempelai.female_family_sequence);
      }
      $(this).html(html);
    }
  });

  // Ganti "A/n Nama Mempelai" di amplop  
  replaceHeadingText($, 'A/n Nama Mempelai', 
    `A/n ${mempelai.male_nickname || mempelai.male_name || 'Mempelai'}`);

  // =========================================
  // 3. INJEKSI QUOTES / AYAT
  // =========================================
  
  if (quotes.content) {
    // Quotes biasanya berisi teks panjang Islam/Kristen di section ke-2
    $('.elementor-heading-title').each(function () {
      const text = $(this).text().trim();
      if (text.includes('Maha suci Allah') || 
          text.includes('sakinah, mawaddah') ||
          text.length > 80) {
        // Ini kemungkinan besar elemen quotes
        const currentText = $(this).text();
        if (currentText.includes('Maha suci') || currentText.includes('mawaddah')) {
          $(this).text(quotes.content);
        }
      }
    });
  }

  // =========================================
  // 4. INJEKSI AMPLOP (No. Rekening)
  // =========================================
  
  if (amplop.bank_accounts && amplop.bank_accounts.length > 0) {
    let bankIdx = 0;
    $('.copy-content.spancontent').each(function () {
      const text = $(this).text().trim();
      // Cek apakah ini nomor rekening (angka) bukan alamat
      if (text.match(/^\d+$/) || text === '00000000000' || text === '0000000000') {
        if (bankIdx < amplop.bank_accounts.length) {
          $(this).text(amplop.bank_accounts[bankIdx].account_number);
          bankIdx++;
        }
      }
    });
  }

  // =========================================
  // 5. INJEKSI JUDUL KUSTOM
  // =========================================
  
  if (judul.judul_cover) {
    replaceHeadingText($, 'WE ARE GETTING', judul.judul_cover);
  }

  // =========================================
  // 6. INJEKSI FOTO PROFIL MEMPELAI
  // =========================================
  
  if (mempelai.male_profile_photo || mempelai.female_profile_photo) {
    // Template "foto" biasanya punya img elemen di section profil mempelai
    // yang bisa diganti src-nya
    // Untuk template "tanpa-foto", elemen ini tidak ada sehingga aman di-skip
  }

  // =========================================
  // 7. INJEKSI GALERI FOTO
  // =========================================
  
  // Galeri foto biasanya di section tertentu, kita bisa ganti src gambar
  // Implementasi lanjutan nanti

  // =========================================
  // FINAL: Kembalikan HTML yang sudah dimodifikasi
  // =========================================
  
  return $.html();
}

/**
 * Format tanggal Indonesia: "Rabu, 15 Juli 2026"
 */
function formatIndonesianDate(dateStr) {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const d = new Date(dateStr);
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format countdown: "Jul 15 2026 12:00:00"
 */
function formatCountdownDate(dateStr) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(dateStr);
  return `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()} 12:00:00`;
}

module.exports = { compileTemplate, findTemplateHtml };
