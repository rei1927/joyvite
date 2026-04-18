$(document).ready(function() {
    // Salin Tautan functionality
    $('#copyLinkBtn').on('click', function(e) {
        e.preventDefault();
        
        var linkUrl = $('#weddingUrl').text();
        
        // Use modern clipboard API
        navigator.clipboard.writeText(linkUrl).then(function() {
            // Change button text temporarily
            var originalHtml = $('#copyLinkBtn').html();
            $('#copyLinkBtn').html('<i class="fas fa-check"></i> Tersalin');
            $('#copyLinkBtn').removeClass('btn-outline-custom').addClass('btn-primary-custom');
            
            setTimeout(function() {
                $('#copyLinkBtn').html(originalHtml);
                $('#copyLinkBtn').removeClass('btn-primary-custom').addClass('btn-outline-custom');
            }, 2000);
        }).catch(function(err) {
            console.error('Failed to copy: ', err);
            alert('Gagal menyalin tautan.');
        });
    });

    // Reset button mock functionality
    $('#resetVisitorBtn').on('click', function(e) {
        e.preventDefault();
        if(confirm('Apakah Anda yakin ingin mereset jumlah pengunjung?')) {
            // Add rotate animation to the reset icon
            $(this).find('i').addClass('animate__animated animate__rotateIn');
            setTimeout(() => {
                $(this).find('i').removeClass('animate__animated animate__rotateIn');
                alert('Jumlah pengunjung berhasil direset.');
            }, 1000);
        }
    });

    // Add gentle hover animations to cards
    $('.setting-card').hover(
        function() {
            $(this).find('i').addClass('animate__animated animate__pulse');
        }, 
        function() {
            $(this).find('i').removeClass('animate__animated animate__pulse');
        }
    );

    // ==========================================
    // AUTO LOAD SAVED SETTINGS FROM DATABASE
    // ==========================================
    async function loadWeddingSettings() {
        try {
            let currentSlug = localStorage.getItem('joyvite_slug') || 'mockup-test-account';
            const apiUrl = window.location.hostname.includes('joyvite.id') ? `https://login.joyvite.id/api/settings/${currentSlug}` : `/api/settings/${currentSlug}`;
            
            const res = await fetch(apiUrl);
            if (!res.ok) return; // Belum ada data
            
            const data = await res.json();
            const settings = data.settings || {};
            
            // Generic Populator
            const populateForm = (obj) => {
                if (!obj) return;
                Object.keys(obj).forEach(key => {
                    const value = obj[key];
                    if (typeof value === 'string' || typeof value === 'number') {
                        const input = $(`[name="${key}"]`);
                        if (input.length) input.val(value);
                    } else if (typeof value === 'boolean') {
                        const input = $(`[name="${key}"]`);
                        if (input.length && (input.attr('type') === 'checkbox' || input.attr('type') === 'radio')) {
                            input.prop('checked', value);
                        }
                    }
                });
            };

            // Jalankan untuk semua section yang menggunakan nama attribute linear
            populateForm(settings.mempelai);
            populateForm(settings.judul);
            populateForm(settings.quotes);
            populateForm(settings.livestream);
            populateForm(settings.popup);
            
            // Isi fallback manual yang bernama beda
            if (settings.amplop && settings.amplop.visible !== undefined) {
                $('[name="amplop_visible"]').prop('checked', settings.amplop.visible);
            }
            if (settings.musik && settings.musik.enabled !== undefined) {
                $('[name="musik_enabled"]').prop('checked', settings.musik.enabled);
            }
            if (settings.galeri && settings.galeri.video_url !== undefined) {
                $('[name="galeri_video_url"]').val(settings.galeri.video_url);
            }

            // Theme selector (Design page)
            if (data.template) {
                $(`input[name="theme_type"][value="${data.template}"]`).prop('checked', true);
            }

            // Preview Images (Mempelai Page)
            if (settings.mempelai) {
                if (settings.mempelai.male_profile_photo) $('#male-account-upload-img').attr('src', settings.mempelai.male_profile_photo);
                if (settings.mempelai.female_profile_photo) $('#female-account-upload-img').attr('src', settings.mempelai.female_profile_photo);
            }

            // Update Link URL di Dashboard (Index Page)
            if ($('#weddingUrl').length) {
                $('#weddingUrl').html('<i class="fa-solid fa-link"></i> https://' + currentSlug + '.joyvite.id');
                // Jadikan bisa diklik
                $('#weddingUrl').attr('href', 'https://' + currentSlug + '.joyvite.id');
                $('#weddingUrl').attr('target', '_blank');
            }

        } catch (error) {
            console.error('Gagal me-load data undangan:', error);
        }
    }
    
    // Jalankan auto-load saat halaman pertama kali dibuka
    loadWeddingSettings();

    // ==========================================
    // LOGIKA HALAMAN MEMPELAI (Image Preview)
    // ==========================================
    
    // Preview Gambar Pria
    $('#male-account-upload').on('change', function(e) {
        var reader = new FileReader();
        var files = e.target.files;
        if (files && files[0]) {
            reader.onload = function() {
                $('#male-account-upload-img').attr('src', reader.result);
            };
            reader.readAsDataURL(files[0]);
        }
    });

    // Preview Gambar Wanita
    $('#female-account-upload').on('change', function(e) {
        var reader = new FileReader();
        var files = e.target.files;
        if (files && files[0]) {
            reader.onload = function() {
                $('#female-account-upload-img').attr('src', reader.result);
            };
            reader.readAsDataURL(files[0]);
        }
    });

    // Tersambung dengan Backend Node.js
    $('#wedding-form').on('submit', async function(e) {
        e.preventDefault();
        var form = $(this)[0];
        var btn = $(this).find('button[type="submit"]');
        var originalText = btn.html();
        
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Menyimpan...');
        
        try {
            // 1. Ambil pengaturan form menjadi Object JSON Datar
            var formData = new FormData(form);
            var flatData = {};
            
            for (let [key, value] of formData.entries()) {
                if (value instanceof File && value.name) {
                    // Upload file terpisah ke API MinIO kita
                    let fileData = new FormData();
                    fileData.append('file', value);
                    
                    const uploadRes = await fetch('https://login.joyvite.id/api/upload', {
                        method: 'POST',
                        body: fileData
                    });
                    const uploadJson = await uploadRes.json();
                    if(uploadJson.url) {
                        flatData[key] = uploadJson.url; // Ganti File menjadi URL S3
                    }
                } else if (!(value instanceof File)) {
                    // Cek jika ini adalah form array (contoh location.html)
                    if (key.endsWith('[]')) {
                        let cleanKey = key.slice(0, -2);
                        if (!flatData[cleanKey]) flatData[cleanKey] = [];
                        flatData[cleanKey].push(value);
                    } else {
                        // Kumpulkan checkboxes multiple dengan nama yg sama
                        if (flatData[key] !== undefined) {
                            if (!Array.isArray(flatData[key])) {
                                flatData[key] = [flatData[key]];
                            }
                            flatData[key].push(value);
                        } else {
                            flatData[key] = value;
                        }
                    }
                }
            }

            // 2. Format menjadi Nested Settings Object yang sesuai Joyvite Engine
            var nestedSettings = {};
            
            // a. Jika Halaman Mempelai
            if (flatData['male_name'] || flatData['female_name']) {
                nestedSettings.mempelai = {};
                for (let k in flatData) {
                    if (k.startsWith('male_') || k.startsWith('female_')) {
                        nestedSettings.mempelai[k] = flatData[k];
                    }
                }
            }
            
            // b. Jika Halaman Lokasi Acara
            if (flatData['event_type']) {
                nestedSettings.events = [];
                let eventsList = Array.isArray(flatData['event_type']) ? flatData['event_type'] : [flatData['event_type']];
                
                for(let i=0; i<eventsList.length; i++) {
                    let getVal = (key) => Array.isArray(flatData[key]) ? flatData[key][i] : flatData[key];
                    nestedSettings.events.push({
                        type: getVal('event_type'),
                        place_name: getVal('event_place_name'),
                        location: getVal('event_location'),
                        gmaps: getVal('event_gmaps'),
                        date: getVal('event_date'),
                        time_start: getVal('event_time_start'),
                        time_end: getVal('event_time_end'),
                        until_finish: getVal('event_until_finish') === 'true',
                        visible: getVal('event_visible') === 'true' || getVal('event_visible') === 'on'
                    });
                }
            }
            
            // c. Jika Halaman Judul
            if (flatData['judul_cover'] || flatData['judul_countdown']) {
                nestedSettings.judul = {
                    judul_cover: flatData['judul_cover'],
                    judul_countdown: flatData['judul_countdown'],
                    label_hari: flatData['judul_label_hari'],
                    label_jam: flatData['judul_label_jam'],
                    label_menit: flatData['judul_label_menit'],
                    label_detik: flatData['judul_label_detik']
                };
            }

            // d. Jika Halaman Quotes
            if (flatData['quote_content']) {
                nestedSettings.quotes = {
                    content: flatData['quote_content'],
                    author: flatData['quote_author'] || ''
                };
            }

            // e. Jika Halaman Cerita Cinta
            if (flatData['story_title']) {
                nestedSettings.love_story = [];
                let titles = Array.isArray(flatData['story_title']) ? flatData['story_title'] : [flatData['story_title']];
                for (let i = 0; i < titles.length; i++) {
                    let getVal = (key) => Array.isArray(flatData[key]) ? flatData[key][i] : flatData[key];
                    nestedSettings.love_story.push({
                        title: getVal('story_title'),
                        date: getVal('story_date'),
                        description: getVal('story_desc')
                    });
                }
            }

            // f. Jika Halaman Livestream
            if (flatData['livestream_url']) {
                nestedSettings.livestream = {
                    url: flatData['livestream_url'],
                    description: flatData['livestream_desc'] || ''
                };
            }

            // g. Jika Halaman Popup
            if (flatData['popup_message'] || flatData['popup_btn_text']) {
                nestedSettings.popup = {
                    message: flatData['popup_message'],
                    btn_text: flatData['popup_btn_text']
                };
            }

            // h. Jika Halaman Musik
            if (flatData['musik_enabled'] !== undefined) {
                nestedSettings.musik = {
                    enabled: flatData['musik_enabled'] === 'on' || flatData['musik_enabled'] === 'true'
                };
            }

            // i. Jika Halaman Amplop
            if (flatData['amplop_visible'] !== undefined) {
                nestedSettings.amplop = {
                    visible: flatData['amplop_visible'] === 'on' || flatData['amplop_visible'] === 'true'
                };
            }

            // k. Pengaturan Tambahan (Desain Halaman)
            if (flatData['nav_bar'] !== undefined || flatData['penunjuk_arah'] !== undefined) {
                nestedSettings.additionalSettings = {
                    nav_bar: flatData['nav_bar'] === 'on',
                    penunjuk_arah: flatData['penunjuk_arah'] === 'on',
                    tampilkan_countdown: flatData['tampilkan_countdown'] === 'on',
                    tampilkan_foto_mempelai: flatData['tampilkan_foto_mempelai'] === 'on',
                    tanggal_pada_cover: flatData['tanggal_pada_cover'] === 'on',
                    format_tanggal: flatData['format_tanggal'],
                    posisi_nama: flatData['posisi_nama']
                };
            }

            // j. Fallback: template theme dari desain.html
            let templateName = null;
            if (flatData['selectedTheme']) {
                templateName = flatData['selectedTheme'];
            } else if ($('input[name="selectedTheme"]:checked').length > 0) {
                templateName = $('input[name="selectedTheme"]:checked').val();
            }

            
            // Galeri video URL
            if (flatData['galeri_video_url']) {
                nestedSettings.galeri = {
                    video_url: flatData['galeri_video_url']
                };
            }

            // 3. AUTO GENERATOR SUBDOMAIN SLUG
            let currentSlug = localStorage.getItem('joyvite_slug');
            // Jika form mempelai punya nickname, auto generate slug baru
            if (flatData['male_nickname'] && flatData['female_nickname']) {
                currentSlug = (flatData['male_nickname'] + '-' + flatData['female_nickname'])
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, '')
                    .replace(/\s+/g, '-');
                localStorage.setItem('joyvite_slug', currentSlug);
            }
            // Fallback
            if (!currentSlug) currentSlug = 'undangan-baru-' + Math.floor(Math.random() * 1000);

            // 4. Kirim seluruh JSON ke pangkalan data PostgreSQL Joyvite
            const dbRes = await fetch('https://login.joyvite.id/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    slug: currentSlug, 
                    settings: nestedSettings,
                    template: templateName 
                })
            });

            if (!dbRes.ok) throw new Error('Gagal menyimpan ke pangkalan data HTTP ' + dbRes.status);
            
            // Animasi transisi sukses
            btn.html('<i class="fa-solid fa-check me-2"></i>Tersimpan');
            btn.removeClass('btn-primary').addClass('btn-success');
            
            // Trigger custom event untuk memberitahu UI memperbarui Link dll
            $(document).trigger('joyvite:saved', [currentSlug]);

            setTimeout(function() {
                btn.html(originalText);
                btn.removeClass('btn-success').addClass('btn-primary');
                btn.prop('disabled', false);
            }, 2000);
            
        } catch (error) {
            console.error('Error Integrasi Backend:', error);
            alert('Terjadi kesalahan koneksi ke server pusat! (' + error.message + ')');
            btn.html('<i class="fa-solid fa-triangle-exclamation me-2"></i>Gagal');
            btn.removeClass('btn-primary').addClass('btn-danger');
            setTimeout(() => {
                btn.html(originalText);
                btn.removeClass('btn-danger').addClass('btn-primary');
                btn.prop('disabled', false);
            }, 3000);
        }
    });

});
