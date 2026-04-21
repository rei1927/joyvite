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

    // ======== A. Heuristik Injeksi Waktu ========
    let timeIndex = 0;
    
    // Cari teks yang memiliki format Jam (misal "08:00", "08.00 WIB", dll) pada elemen heading atau teks
    $('.elementor-heading-title, .elementor-text-editor, .elementor-button-text').each(function () {
      const text = $(this).text().trim();
      const lowerText = text.toLowerCase();
      
      // Deteksi format jam HH:MM atau HH.MM
      if (lowerText.match(/\b\d{2}[\:\.]\d{2}\b/) || lowerText.includes('pukul') || lowerText.match(/\bjam\s+\d{1,2}\b/)) {
         timeIndex++;
         
         if (timeIndex === 1 && primaryEvent.time_start) {
             const timeText = primaryEvent.until_finish 
               ? `Pukul ${primaryEvent.time_start} WIB - Selesai`
               : `Pukul ${primaryEvent.time_start} WIB`;
             $(this).text(timeText);
             console.log(`[Heuristic] Diganti Jam Akad: -> ${timeText}`);
         } else if (timeIndex === 2 && secondaryEvent && secondaryEvent.time_start) {
             const timeText = secondaryEvent.until_finish 
               ? `Pukul ${secondaryEvent.time_start} WIB - Selesai`
               : `Pukul ${secondaryEvent.time_start} WIB`;
             $(this).text(timeText);
             console.log(`[Heuristic] Diganti Jam Resepsi: -> ${timeText}`);
         }
      }
    });

    // ======== B. Heuristik Injeksi Tanggal ========
    if (primaryEvent.date) {
      const dateStr = formatIndonesianDate(primaryEvent.date, additional.format_tanggal);
      let isFirstDate = true;
      $('.elementor-heading-title, .elementor-text-editor').each(function () {
        const text = $(this).text().trim();
        // Deteksi format tanggal Indonesia (Senin, 17 Agustus 1945) atau format numerik (17/08/1945)
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
      
      // Update data atribut countdown
      $('[data-date]').attr('data-date', formatCountdownDate(primaryEvent.date));
      const day = new Date(primaryEvent.date).getDate();
      $('[data-to-value]').each(function() {
        const currentVal = $(this).attr('data-to-value');
        if (parseInt(currentVal) <= 31) {
          $(this).attr('data-to-value', day.toString());
        }
      });
    }

    // ======== C. Heuristik Injeksi Lokasi Acara ========
    let locationIndex = 0;
    
    // Biasanya nama lokasi berada di elemen spancontent, text-editor, atau heading tertentu sesudah jam
    // Kita juga bisa mencari kata kunci "Gedung", "Hotel", "Kediaman", "Jalan", "Jl."
    $('.elementor-heading-title, .spancontent, .elementor-text-editor, .weddingpress-location-text, p').each(function () {
      const text = $(this).text().trim();
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes('kediaman') || lowerText.includes('gedung') || lowerText.includes('hotel') || lowerText.includes('jl.') || lowerText.includes('jalan ') || lowerText.includes('masjid')) {
        // Skip jika teks ini terlalu panjang (misal deskripsi full alamat map) dan kita hanya mau ganti nama lokasinya
        // Namun, jika teks mengandung koma/alamat persis, kita timpa keseluruhannya
        if (text.length > 5 && text.length < 100 && !lowerText.includes('akad') && !lowerText.includes('resepsi')) {
            locationIndex++;
            if (locationIndex === 1 && primaryEvent.place_name) {
                $(this).text(primaryEvent.place_name);
                console.log(`[Heuristic] Diganti Alamat Akad: -> ${primaryEvent.place_name}`);
            } else if (locationIndex === 2 && secondaryEvent && secondaryEvent.place_name) {
                $(this).text(secondaryEvent.place_name);
                console.log(`[Heuristic] Diganti Alamat Resepsi: -> ${secondaryEvent.place_name}`);
            }
        }
      }
    });

    if (primaryEvent.gmaps) {
      $('iframe[src*="maps.google"]').attr('src', primaryEvent.gmaps);
    }
  }

  // =========================================
  // 2. INJEKSI NAMA MEMPELAI SECARA HEURISTIK DOM
  // =========================================
  
  // A. Deteksi Nama Panggilan dari Cover
  let detectedNicknames = [];
  $('.elementor-heading-title').each(function () {
    const text = $(this).text().trim();
    const lowerText = text.toLowerCase();
    if (text.match(/^.+\s*[&]\s*.+$/) && !text.includes(',') && text.length < 40 && !lowerText.includes('bpk') && !lowerText.includes('bapak') && !lowerText.includes('ibu')) {
      const parts = text.split('&').map(s => s.trim());
      if (parts.length === 2 && parts[0].length > 0 && parts[1].length > 0) {
        detectedNicknames = parts;
      }
    }
  });

  // B. Eksekusi Traversal untuk Nama Profil (Putra/Putri dari)
  let lastSeenHeading = null;
  let lastSeenText = '';
  
  let detectedFemaleName = '';
  let detectedMaleName = '';

  $('.elementor-widget').each(function() {
     const heading = $(this).find('.elementor-heading-title');
     const textEditor = $(this).find('.elementor-text-editor');
     
     let text = '';
     let el = null;

     if (heading.length > 0) {
        text = heading.text().trim();
        el = heading;
     } else if (textEditor.length > 0) {
        text = textEditor.text().trim();
     } else {
        text = $(this).text().trim();
     }

     const lowerText = text.toLowerCase();
     
     // Deteksi area mempelai wanita
     if (lowerText.includes('putri dari') || lowerText.match(/putri (pertama|kedua|ketiga|keempat|kelima|keenam|bungsu)/)) {
         if (lastSeenHeading) {
             detectedFemaleName = lastSeenText;
             if (mempelai.female_name) {
                 $(lastSeenHeading).text(mempelai.female_name);
                 console.log(`[Heuristic] Diganti profil WANITA: ${detectedFemaleName} -> ${mempelai.female_name}`);
             }
         }
     }
     // Deteksi area mempelai pria
     else if (lowerText.includes('putra dari') || lowerText.match(/putra (pertama|kedua|ketiga|keempat|kelima|keenam|bungsu)/)) {
         if (lastSeenHeading) {
             detectedMaleName = lastSeenText;
             if (mempelai.male_name) {
                 $(lastSeenHeading).text(mempelai.male_name);
                 console.log(`[Heuristic] Diganti profil PRIA: ${detectedMaleName} -> ${mempelai.male_name}`);
             }
         }
     }
     // Simpan kandidat nama profil (biasanya pendek, bukan deskripsi panjang)
     else if (el && text.length > 2 && text.length < 40 && !text.includes('&') && !lowerText.includes('bapak') && !lowerText.includes('ibu')) {
         lastSeenHeading = el;
         lastSeenText = text;
     }
  });

  // C. Tebak Nickname Pria/Wanita Asli Template
  let templateFemaleNick = '';
  let templateMaleNick = '';
  
  if (detectedNicknames.length === 2 && detectedFemaleName && detectedMaleName) {
    // Cocokkan nickname dengan nama panjang yang baru saja dideteksi
    const n1 = detectedNicknames[0].toLowerCase();
    const n2 = detectedNicknames[1].toLowerCase();
    
    if (detectedFemaleName.toLowerCase().includes(n1)) {
        templateFemaleNick = detectedNicknames[0];
        templateMaleNick = detectedNicknames[1];
    } else if (detectedFemaleName.toLowerCase().includes(n2)) {
        templateFemaleNick = detectedNicknames[1];
        templateMaleNick = detectedNicknames[0];
    } else if (detectedMaleName.toLowerCase().includes(n1)) {
        templateMaleNick = detectedNicknames[0];
        templateFemaleNick = detectedNicknames[1];
    } else if (detectedMaleName.toLowerCase().includes(n2)) {
        templateMaleNick = detectedNicknames[1];
        templateFemaleNick = detectedNicknames[0];
    } else {
        // Fallback: anggap format umumnya Wanita & Pria jika tak bisa ditebak
        templateFemaleNick = detectedNicknames[0];
        templateMaleNick = detectedNicknames[1];
    }
  } else if (detectedNicknames.length === 2) {
    templateFemaleNick = detectedNicknames[0];
    templateMaleNick = detectedNicknames[1];
  }

  // Fallback defaults jika deteksi gagal
  const defaultMaleNames = ['Haqi', 'Pria', 'Romeo', 'Aria'];
  const defaultFemaleNames = ['Dewi', 'Wanita', 'Juliet', 'Yori'];
  
  if (templateMaleNick) defaultMaleNames.push(templateMaleNick);
  if (templateFemaleNick) defaultFemaleNames.push(templateFemaleNick);

  // D. Terapkan Penggantian Nickname Individual
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

  // E. Terapkan Nama Cover (A & B) secara global
  if (mempelai.male_nickname && mempelai.female_nickname) {
    const isPriaWanita = !additional.posisi_nama || additional.posisi_nama === 'pria_wanita';
    const coverName = isPriaWanita 
      ? `${mempelai.male_nickname} & ${mempelai.female_nickname}`
      : `${mempelai.female_nickname} & ${mempelai.male_nickname}`;
      
    // Target 1: WeddingPress cover div .wdp-mempelai
    $('.wdp-mempelai').each(function () {
      $(this).text(coverName);
    });
    
    // Target 2: Elementor headings yang mengandung &
    $('.elementor-heading-title').each(function () {
      const text = $(this).text().trim();
      const lowerText = text.toLowerCase();
      if (text.match(/^.+\s*[&]\s*.+$/) && !text.includes(',') && text.length < 40 && !lowerText.includes('bpk') && !lowerText.includes('bapak') && !lowerText.includes('ibu')) {
        $(this).text(coverName);
      }
    });

    // Target 3: Meta SEO
    $('meta[property="og:title"]').each(function () { $(this).attr('content', coverName); });
    $('title').text(coverName);
    $('meta[property="og:description"]').each(function () {
      const content = $(this).attr('content');
      if (content) {
        let newContent = content.replace(/The Wedding Of\s+[A-Za-z]+\s*(&amp;|&)\s*[A-Za-z]+/gi, "The Wedding Of " + coverName);
        if (newContent === content) {
          const startMatches = content.match(/^[A-Za-z]+\s*(&amp;|&)\s*[A-Za-z]+/i);
          if (startMatches) {
            newContent = content.replace(startMatches[0], coverName);
          }
        }
        $(this).attr('content', newContent);
      }
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
  // 8. INJEKSI FOTO PROFIL MEMPELAI (HEURISTIK)
  // =========================================
  
  if (mempelai.male_profile_photo || mempelai.female_profile_photo) {
    let recentImages = [];
    
    // Melakukan loop pada seluruh widget untuk melacak letak gambar relatif terhadap teks profil
    $('.elementor-widget').each(function() {
       const img = $(this).find('img');
       const text = $(this).text().trim().toLowerCase();
       
       if (img.length > 0) {
           // Simpan kandidat gambar (Abaikan yang nama filenya berbau hiasan bunga/daun/ornamen)
           img.each(function() {
               const src = $(this).attr('src') || '';
               const lowerSrc = src.toLowerCase();
               if (!lowerSrc.includes('bunga') && !lowerSrc.includes('flower') && 
                   !lowerSrc.includes('daun') && !lowerSrc.includes('leaf') &&
                   !lowerSrc.includes('ornament') && !lowerSrc.includes('bg') && 
                   !lowerSrc.includes('shape') && !lowerSrc.includes('mask')) {
                   recentImages.push(this);
               }
           });
           
           // Simpan maksimal 3 gambar terbaru ke memori untuk efisiensi
           if (recentImages.length > 3) recentImages.shift();
       }
       
       // Jika menemukan dekripsi mempelai wanita
       if (text.includes('putri dari') || text.match(/putri (pertama|kedua|ketiga|keempat|kelima|keenam|bungsu)/)) {
           if (recentImages.length > 0 && mempelai.female_profile_photo) {
               // Biasanya foto mempelai adalah gambar terakhir atau kedua terakhir sebelum teks profil
               const targetImg = recentImages[recentImages.length - 1];
               $(targetImg).attr('src', mempelai.female_profile_photo);
               // Hapus atribut srcset agar gambar baru tidak di-override oleh layar responsif Elementor
               $(targetImg).removeAttr('srcset sizes');
                $(targetImg).attr('style', 'object-fit: cover !important; aspect-ratio: 1/1 !important; border-radius: 50% !important; ' + ($(targetImg).attr('style') || ''));
               console.log('[Heuristic] Foto WANITA terganti.');
               // Kosongkan array untuk pencarian pria berikutnya
               recentImages = []; 
           }
       }
       // Jika menemukan dekripsi mempelai pria
       else if (text.includes('putra dari') || text.match(/putra (pertama|kedua|ketiga|keempat|kelima|keenam|bungsu)/)) {
           if (recentImages.length > 0 && mempelai.male_profile_photo) {
               const targetImg = recentImages[recentImages.length - 1];
               $(targetImg).attr('src', mempelai.male_profile_photo);
               $(targetImg).removeAttr('srcset sizes');
                $(targetImg).attr('style', 'object-fit: cover !important; aspect-ratio: 1/1 !important; border-radius: 50% !important; ' + ($(targetImg).attr('style') || ''));
               console.log('[Heuristic] Foto PRIA terganti.');
               recentImages = []; 
           }
       }
    });

    // Fallback Darurat: Jika teks "putra dari" tidak ditemukan (contoh template yang sangat abstrak)
    let profileImgIdx = 0;
    $('section[id*="mempelai"], section[id*="profil"], section[id*="about"], .elementor-section:contains("Putra"), .elementor-section:contains("Putri")').find('img').each(function() {
      const src = $(this).attr('src') || '';
      const lowerSrc = src.toLowerCase();
      // Pastikan bukan elemen hiasan
      if (!lowerSrc.includes('bunga') && !lowerSrc.includes('flower') && !lowerSrc.includes('daun') && !lowerSrc.includes('leaf') && !lowerSrc.includes('ornament')) {
          profileImgIdx++;
          // Kita hanya fallback jika heuristic utama (recentImages) belum berhasil menempelkannya
          const currentSrc = $(this).attr('src');
          if (profileImgIdx === 1 && mempelai.male_profile_photo && currentSrc !== mempelai.male_profile_photo) {
            $(this).attr('src', mempelai.male_profile_photo);
            $(this).removeAttr('srcset sizes');
            $(this).attr('style', 'object-fit: cover !important; aspect-ratio: 1/1 !important; border-radius: 50% !important; ' + ($(this).attr('style') || ''));
            $(this).attr('style', 'object-fit: cover !important; aspect-ratio: 1/1 !important; border-radius: 50% !important; ' + ($(this).attr('style') || ''));
          } else if (profileImgIdx === 2 && mempelai.female_profile_photo && currentSrc !== mempelai.female_profile_photo) {
            $(this).attr('src', mempelai.female_profile_photo);
            $(this).removeAttr('srcset sizes');
            $(this).attr('style', 'object-fit: cover !important; aspect-ratio: 1/1 !important; border-radius: 50% !important; ' + ($(this).attr('style') || ''));
            $(this).attr('style', 'object-fit: cover !important; aspect-ratio: 1/1 !important; border-radius: 50% !important; ' + ($(this).attr('style') || ''));
          }
      }
    });
  }

  // =========================================
  // 9. INJEKSI CERITA CINTA (LOVE STORY) (HEURISTIK)
  // =========================================
  
  const love_story = settings.love_story || [];
  if (love_story.length > 0) {
    let storyIdx = 0;
    
    // Kita gunakan dua sasaran: Widget Timeline khusus (pp-timeline-item) DAN Column generic Elementor
    $('section[id*="cerita"], section[id*="story"], section[id*="love"], .elementor-section:contains("Bertemu"), .elementor-section:contains("Cerita"), .elementor-section:contains("Story")').find('.pp-timeline-item, .elementor-column').each(function() {
      // Mencegah child column diproses dua kali jika Parentnya sudah terproses
      if ($(this).attr('data-processed-story')) return;
      
      const colText = $(this).text().trim();
      const hasTitlePattern = colText.match(/(Awal|Pertama|First|Pertemuan|Lamaran|Engagement|Chapter|Tahun|Bulan)/i);
      const hasDatePattern = colText.match(/(\d{4}|\d{1,2}\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)\w*\s+\d{4})/i);
      
      if (hasTitlePattern || hasDatePattern) {
        if (storyIdx < love_story.length) {
          const story = love_story[storyIdx];
          
          if ($(this).hasClass('pp-timeline-item')) {
              // 1. Template Khusus pp-timeline
              if (story.title) $(this).find('.pp-timeline-card-title').text(story.title);
              if (story.date) $(this).find('.pp-timeline-card-date').text(story.date);
              if (story.description) $(this).find('.pp-timeline-card-content p').text(story.description);
              if (story.photo) {
                  const img = $(this).find('.pp-timeline-card-image img');
                  img.attr('src', story.photo);
                  img.removeAttr('srcset sizes');
              }
              storyIdx++;
              $(this).attr('data-processed-story', 'true');
          } else {
              // 2. Template Column Generic
              let headerCount = 0;
              $(this).find('.elementor-heading-title').each(function() {
                  const txt = $(this).text().trim();
                  if (txt.length > 0 && txt.length < 50) { // Jika cukup pendek, anggap sebagai judul/tanggal
                      if (headerCount === 0 && story.title) {
                          $(this).text(story.title);
                      } else if (headerCount === 1 && story.date) {
                          $(this).text(story.date);
                      }
                      headerCount++;
                  }
              });
              
              // Ganti Description (biasanya di text-editor)
              $(this).find('.elementor-text-editor, .elementor-widget-text-editor p, p').each(function() {
                  const txt = $(this).text().trim();
                  if (txt.length > 20 && story.description && !txt.match(/Awal|Pertemuan|Lamaran/)) {
                      $(this).text(story.description);
                  }
              });
              
              // Ganti Foto
              if (story.photo) {
                 $(this).find('img').each(function() {
                     const lowerSrc = ($(this).attr('src') || '').toLowerCase();
                     if (!lowerSrc.includes('bunga') && !lowerSrc.includes('flower') && !lowerSrc.includes('daun') && !lowerSrc.includes('ornament')) {
                         $(this).attr('src', story.photo);
                         $(this).removeAttr('srcset sizes');
            $(this).attr('style', 'object-fit: cover !important; aspect-ratio: 1/1 !important; border-radius: 50% !important; ' + ($(this).attr('style') || ''));
                     }
                 });
              }
              
              storyIdx++;
              $(this).attr('data-processed-story', 'true');
              $(this).find('*').attr('data-processed-story', 'true'); // Tandai childs agar tidak terproses duplikat
          }
        }
      }
    });

    // Fallback darurat (Legacy Title detection)
    let legacyIdx = 0;
    $('section[id*="cerita"], section[id*="story"], section[id*="love"]').find('.elementor-heading-title:not([data-processed-story])').each(function() {
      const text = $(this).text().trim();
      if (text.match(/^(Awal|Pertama|First|Pertemuan|Lamaran|Engagement|Chapter)/i)) {
        if (legacyIdx < love_story.length) {
          if (love_story[legacyIdx].title) $(this).text(love_story[legacyIdx].title);
          legacyIdx++;
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
  
  // Rewrite path relatif CSS/JS/Gambar ke aset lokal Joyvite
  // File statis sudah diekspos di server.js melalui rute /joyvite-assets
  finalHtml = finalHtml.replace(/(href|src|srcset)=["']\.\.\/wp-content\//g, `$1="/joyvite-assets/${templateSlug}/menujuacara.id/wp-content/`);
  finalHtml = finalHtml.replace(/(href|src|srcset)=["']\.\.\/wp-includes\//g, `$1="/joyvite-assets/${templateSlug}/menujuacara.id/wp-includes/`);
  
  // Rewrite inline styles URL patterns
  finalHtml = finalHtml.replace(/url\(\.\.\/wp-content\//g, `url(/joyvite-assets/${templateSlug}/menujuacara.id/wp-content/`);
  finalHtml = finalHtml.replace(/url\('\.\.\/wp-content\//g, `url('/joyvite-assets/${templateSlug}/menujuacara.id/wp-content/`);
  finalHtml = finalHtml.replace(/url\("\.\.\/wp-content\//g, `url("/joyvite-assets/${templateSlug}/menujuacara.id/wp-content/`);

  finalHtml = finalHtml.replace(/url\(\.\.\/wp-includes\//g, `url(/joyvite-assets/${templateSlug}/menujuacara.id/wp-includes/`);
  finalHtml = finalHtml.replace(/url\('\.\.\/wp-includes\//g, `url('/joyvite-assets/${templateSlug}/menujuacara.id/wp-includes/`);
  finalHtml = finalHtml.replace(/url\("\.\.\/wp-includes\//g, `url("/joyvite-assets/${templateSlug}/menujuacara.id/wp-includes/`);
  
  // Rewrite fonts & CDN relative paths
  finalHtml = finalHtml.replace(/(href|src)=["']\.\.\/\.\.\/fonts\.googleapis\.com\//g, '$1="https://fonts.googleapis.com/');
  finalHtml = finalHtml.replace(/(href|src)=["']\.\.\/\.\.\/fonts\.gstatic\.com\//g, '$1="https://fonts.gstatic.com/');
  finalHtml = finalHtml.replace(/(href|src)=["']\.\.\/\.\.\/cdnjs\.cloudflare\.com\//g, '$1="https://cdnjs.cloudflare.com/');
  finalHtml = finalHtml.replace(/(href|src)=["']\.\.\/\.\.\/unpkg\.com\//g, '$1="https://unpkg.com/');
  
  // Rewrite data-thumbnail untuk gallery (absolute ke localhost assets)
  finalHtml = finalHtml.replace(/data-thumbnail=["']https:\/\/menujuacara\.id\//g, `data-thumbnail="/joyvite-assets/${templateSlug}/menujuacara.id/`);

  // Rewrite social media & external links
  finalHtml = finalHtml.replace(/(href)="\.\.\/\.\.\/instagram\.com\//g, '$1="https://instagram.com/');
  finalHtml = finalHtml.replace(/(href)="\.\.\/\.\.\/www\.google\.com\//g, '$1="https://www.google.com/');
  finalHtml = finalHtml.replace(/(href)="\.\.\/\.\.\/accounts\.google\.com\//g, '$1="https://accounts.google.com/');
  finalHtml = finalHtml.replace(/(href)="\.\.\/\.\.\/api\.whatsapp\.com\//g, '$1="https://api.whatsapp.com/');
  finalHtml = finalHtml.replace(/(href)="\.\.\/\.\.\/maps\.google\.com\//g, '$1="https://maps.google.com/');

  // Semua logic CSS/JS override yang mengganggu animasi native WeddingPress telah dihapuskan.
  // Karena bypass NGINX (/joyvite-assets) berhasil, template akan memuat CSS bawaannya sendiri.

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
