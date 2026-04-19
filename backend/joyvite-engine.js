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
  const additional = settings.additionalSettings || {};

  console.log(`[DEBUG Engine] Render URL for slug: ${templateSlug}`);
  console.log(`[DEBUG Engine] settings.mempelai:`, mempelai);
  console.log(`[DEBUG Engine] settings.additionalSettings:`, additional);


  // =========================================
  // ADVANCED SETTINGS (PENGATURAN TAMBAHAN)
  // =========================================
  if (additional.nav_bar === false) {
    $('head').append('<style>.navbar, .elementor-location-footer, #navigasi, .nav-menu { display: none !important; }</style>');
  }
  
  if (additional.penunjuk_arah === false) {
    $('.elementor-widget-google_maps').remove();
    $('a[href*="maps.google.com"], a[href*="goo.gl"]').closest('.elementor-widget-button').remove();
  }
  
  if (additional.tampilkan_countdown === false) {
    $('.wpkoi-elements-countdown-wrapper, .elementor-widget-weddingpress-countdown').remove();
  }
  
  if (additional.tampilkan_foto_mempelai === false) {
    $('head').append('<style>.elementor-widget-image img, .elementor-image img { display: none !important; }</style>');
    // Catatan: Akan menyembunyikan gambar-gambar umum, bisa dispesifikkan ke blok profile jika ada class khusus
  }

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

    // Tanggal
    if (primaryEvent.date) {
      const dateStr = formatIndonesianDate(primaryEvent.date, additional.format_tanggal);
      let isFirstDate = true;
      $('.elementor-heading-title').each(function () {
        const text = $(this).text().trim();
        if (text.match(/^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu),?\s+\d+/i) || 
            text.match(/^\d{1,2}\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)/i) || 
            text.match(/^\d{2}\s*\/\s*\d{2}\s*\/\s*\d{4}/)) {
          
          if (isFirstDate && additional.tanggal_pada_cover === false) {
             $(this).text('');
          } else {
             $(this).text(dateStr);
          }
          isFirstDate = false;
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
  
  // Nama panggilan di cover (.wdp-mempelai = WeddingPress cover element)
  if (mempelai.male_nickname && mempelai.female_nickname) {
    const isPriaWanita = !additional.posisi_nama || additional.posisi_nama === 'pria_wanita';
    const coverName = isPriaWanita 
      ? `${mempelai.male_nickname} & ${mempelai.female_nickname}`
      : `${mempelai.female_nickname} & ${mempelai.male_nickname}`;
      
    console.log(`[DEBUG Engine] Execution reached Mempelai Mapping! coverName: ${coverName}`);
    
    // Target 1: WeddingPress cover div .wdp-mempelai
    $('.wdp-mempelai').each(function () {
      $(this).text(coverName);
    });
    
    // Target 2: Heading title yang berisi format "Nama & Nama" (cover headings)
    $('.elementor-heading-title').each(function () {
      const text = $(this).text().trim();
      const lowerText = text.toLowerCase();
      // Match pattern: "Haqi & Dewi" atau nama apapun yang dipisah "&"
      if (text.match(/^.+\s*[&]\s*.+$/) && !text.includes(',') && text.length < 40 && !lowerText.includes('bpk') && !lowerText.includes('bapak') && !lowerText.includes('ibu')) {
        $(this).text(coverName);
        console.log(`[DEBUG Engine] Target 2 replaced heading containing '&' with: ${coverName}`);
      }
    });

    // Target 3: Meta og:description (SEO)
    $('meta[property="og:description"]').each(function () {
      const content = $(this).attr('content');
      if (content) {
        // Ganti berbagai macam format nama "Name & Name" atau "Name &amp; Name"
        let newContent = content.replace(/[A-Za-z]+\s*(&amp;|&)\s*[A-Za-z]+/gi, coverName);
        $(this).attr('content', newContent);
      }
    });

    $('meta[property="og:title"]').each(function () {
      $(this).attr('content', coverName);
    });
    $('title').text(coverName);
  }

  // Ganti nama mempelai di bagian "TENTANG KAMI"
  let mempelaiCount = 0;
  $('.elementor-heading-title').each(function () {
    const text = $(this).text().trim();
    if (text === 'Nama Mempelai' || text === 'Yori' || text === 'Aria' || text === 'Romeo' || text === 'Juliet' || text === 'Aria Wicaksono' || text === 'Elsa Mayori') {
      mempelaiCount++;
      if (mempelaiCount === 1 && mempelai.female_name) {
        $(this).text(mempelai.female_name);
      } else if (mempelaiCount === 2 && mempelai.male_name) {
        $(this).text(mempelai.male_name);
      }
    }
  });

  // Ganti nama panggilan individual di headings
  const defaultMaleNames = ['Haqi', 'Pria', 'Nama Panggilan Pria', 'Romeo', 'Aria'];
  const defaultFemaleNames = ['Dewi', 'Wanita', 'Nama Panggilan Wanita', 'Juliet', 'Yori'];
  
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

  // Ganti nama lengkap jika ada nama spesifik
  if (mempelai.male_name) {
    replaceHeadingText($, 'Aria Wicaksono', mempelai.male_name);
  }
  if (mempelai.female_name) {
    replaceHeadingText($, 'Elsa Mayori', mempelai.female_name);
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
  // 5. INJEKSI JUDUL KUSTOM (DIPERLUAS)
  // =========================================
  
  if (judul.judul_cover) {
    // Replace judul cover pada berbagai template
    const coverDefaults = ['WE ARE GETTING', 'THE WEDDING OF', 'Pernikahan', 'Wedding Invitation'];
    coverDefaults.forEach(d => replaceHeadingText($, d, judul.judul_cover));
  }

  if (judul.judul_countdown) {
    const countdownDefaults = ['Menghitung Hari', 'Counting Days'];
    countdownDefaults.forEach(d => replaceHeadingText($, d, judul.judul_countdown));
  }

  // Label countdown (Hari, Jam, Menit, Detik)
  if (judul.label_hari || judul.label_jam || judul.label_menit || judul.label_detik) {
    $('.wpkoi-elements-countdown-label').each(function() {
      const text = $(this).text().trim();
      if (text === 'Hari' && judul.label_hari) $(this).text(judul.label_hari);
      if (text === 'Jam' && judul.label_jam) $(this).text(judul.label_jam);
      if (text === 'Menit' && judul.label_menit) $(this).text(judul.label_menit);
      if (text === 'Detik' && judul.label_detik) $(this).text(judul.label_detik);
    });
  }

  // =========================================
  // 6. INJEKSI INSTAGRAM LINKS
  // =========================================
  
  if (mempelai.male_instagram || mempelai.female_instagram) {
    $('a[href*="instagram.com"]').each(function() {
      const href = $(this).attr('href') || '';
      // Ganti username di link instagram
      if (mempelai.male_instagram && (href.includes('username_pria') || href.includes('instagram.com'))) {
        $(this).attr('href', `https://instagram.com/${mempelai.male_instagram}`);
      }
    });
  }

  // =========================================
  // 7. INJEKSI NAMA ORANG TUA WANITA (FIX)
  // =========================================
  
  // Handle orang tua wanita secara terpisah (blok kedua di template)
  let parentBlockCount = 0;
  $('.elementor-heading-title').each(function () {
    let html = $(this).html();
    if (!html) return;

    if (html.includes('Bpk.') && html.includes('Ibu')) {
      parentBlockCount++;
      // Block kedua = orang tua wanita
      if (parentBlockCount === 2) {
        if (mempelai.female_father_name) {
          html = html.replace(/Bpk\.\s*\w+/g, mempelai.female_father_name);
        }
        if (mempelai.female_mother_name) {
          html = html.replace(/Ibu\s*\w+/g, mempelai.female_mother_name);
        }
        $(this).html(html);
      }
    }
  });

  // =========================================
  // 8. INJEKSI FOTO PROFIL MEMPELAI
  // =========================================
  
  if (mempelai.male_profile_photo || mempelai.female_profile_photo) {
    // Template "foto" biasanya punya img elemen di section profil mempelai
    let profileImgIdx = 0;
    // Cari gambar profil di section "tentang kami" / "mempelai"
    $('section[id*="mempelai"], section[id*="profil"], section[id*="about"]').find('img').each(function() {
      profileImgIdx++;
      if (profileImgIdx === 1 && mempelai.male_profile_photo) {
        $(this).attr('src', mempelai.male_profile_photo);
      } else if (profileImgIdx === 2 && mempelai.female_profile_photo) {
        $(this).attr('src', mempelai.female_profile_photo);
      }
    });
  }

  // =========================================
  // 9. INJEKSI CERITA CINTA (LOVE STORY)
  // =========================================
  
  const love_story = settings.love_story || [];
  if (love_story.length > 0) {
    // Template biasanya punya timeline/story section dengan class tertentu
    let storyIdx = 0;
    // Cari elemen timeline di template
    $('section[id*="cerita"], section[id*="story"], section[id*="love"]').find('.elementor-heading-title').each(function() {
      const text = $(this).text().trim();
      // Deteksi placeholder judul cerita
      if (text.match(/^(Awal|Pertama|First|Pertemuan|Lamaran|Engagement|Chapter)/i) || 
          text.match(/^\d{4}$/) || text.match(/^\d{1,2}\s+\w+\s+\d{4}$/)) {
        if (storyIdx < love_story.length) {
          const story = love_story[storyIdx];
          if (story.title) $(this).text(story.title);
          storyIdx++;
        }
      }
    });
  }

  // =========================================
  // 10. INJEKSI LIVESTREAM
  // =========================================
  
  if (livestream.url) {
    // Ganti link livestream pada template
    $('a[href*="youtube"], a[href*="youtu.be"], a[href*="zoom"]').each(function() {
      $(this).attr('href', livestream.url);
    });
    // Ganti iframe YouTube jika ada
    $('iframe[src*="youtube"]').attr('src', livestream.url.replace('watch?v=', 'embed/'));
  }
  if (livestream.description) {
    replaceHeadingText($, 'Saksikan ikrar suci Kami', livestream.description);
  }

  // =========================================
  // 11. INJEKSI POPUP / OPENING
  // =========================================

  const popup = settings.popup || {};
  if (popup.message) {
    // Ganti teks popup opening (biasanya di .wdp-opening atau overlay pertama)
    $('.wdp-opening-text, .opening-text').each(function() {
      $(this).text(popup.message);
    });
    // Fallback: cari teks "Kepada Yth"
    replaceGlobalText = function(html, old, newt) {
      return html.replace(new RegExp(escapeRegex(old), 'gi'), newt);
    };
  }
  if (popup.btn_text) {
    $('.wdp-opening-btn, .opening-btn').each(function() {
      $(this).text(popup.btn_text);
    });
    // Fallback: Ganti "Buka Undangan"
    $('button, a').each(function() {
      if ($(this).text().trim() === 'Buka Undangan') {
        $(this).text(popup.btn_text);
      }
    });
  }

  // =========================================
  // 12. INJEKSI GALERI VIDEO
  // =========================================

  const galeri = settings.galeri || {};
  if (galeri.video_url) {
    // Masukkan video YouTube ke section galeri
    const embedUrl = galeri.video_url.replace('watch?v=', 'embed/');
    $('iframe[src*="youtube"]').attr('src', embedUrl);
  }

  // =========================================
  // 13. INJEKSI MUSIK BACKGROUND
  // =========================================

  const musik = settings.musik || {};
  if (musik.enabled === false) {
    // Hapus semua elemen audio dari template
    $('audio').remove();
    $('[data-audio], .audio-player, .music-control').remove();
  }
  // Jika ada URL musik custom, ganti source audio
  if (musik.url) {
    $('audio source').attr('src', musik.url);
    $('audio').attr('src', musik.url);
  }

  // =========================================
  // FINAL: Rewrite asset URLs agar berfungsi dari domain klien
  // Template scraping menyimpan file dengan path relatif (../wp-content/...)
  // Kita rewrite ke absolute URL menuju sumber asli menujuacara.id
  // =========================================
  
  let finalHtml = $.html();
  
  // Rewrite path relatif CSS/JS/Gambar ke menujuacara.id asli
  // Pattern: href="../wp-content/..." → href="https://menujuacara.id/wp-content/..."
  finalHtml = finalHtml.replace(/(href|src|srcset)="\.\.\/wp-content\//g, '$1="https://menujuacara.id/wp-content/');
  finalHtml = finalHtml.replace(/(href|src|srcset)="\.\.\/wp-includes\//g, '$1="https://menujuacara.id/wp-includes/');
  
  // Rewrite fonts & CDN relative paths
  finalHtml = finalHtml.replace(/(href|src)="\.\.\/\.\.\/fonts\.googleapis\.com\//g, '$1="https://fonts.googleapis.com/');
  finalHtml = finalHtml.replace(/(href|src)="\.\.\/\.\.\/fonts\.gstatic\.com\//g, '$1="https://fonts.gstatic.com/');
  finalHtml = finalHtml.replace(/(href|src)="\.\.\/\.\.\/cdnjs\.cloudflare\.com\//g, '$1="https://cdnjs.cloudflare.com/');
  finalHtml = finalHtml.replace(/(href|src)="\.\.\/\.\.\/unpkg\.com\//g, '$1="https://unpkg.com/');
  
  // Rewrite data-thumbnail untuk gallery (absolute ke menujuacara.id)
  finalHtml = finalHtml.replace(/data-thumbnail="https:\/\/menujuacara\.id\//g, 'data-thumbnail="https://menujuacara.id/');
  
  // Rewrite social media & external links
  finalHtml = finalHtml.replace(/(href)="\.\.\/\.\.\/instagram\.com\//g, '$1="https://instagram.com/');
  finalHtml = finalHtml.replace(/(href)="\.\.\/\.\.\/www\.google\.com\//g, '$1="https://www.google.com/');
  finalHtml = finalHtml.replace(/(href)="\.\.\/\.\.\/accounts\.google\.com\//g, '$1="https://accounts.google.com/');
  finalHtml = finalHtml.replace(/(href)="\.\.\/\.\.\/api\.whatsapp\.com\//g, '$1="https://api.whatsapp.com/');
  finalHtml = finalHtml.replace(/(href)="\.\.\/\.\.\/maps\.google\.com\//g, '$1="https://maps.google.com/');

  return finalHtml;
}

/**
 * Format tanggal Indonesia dengan opsi format
 */
function formatIndonesianDate(dateStr, formatType = 'full') {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const d = new Date(dateStr);
  
  if (formatType === 'numeric') {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd} / ${mm} / ${d.getFullYear()}`;
  } else if (formatType === 'short') {
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  
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
