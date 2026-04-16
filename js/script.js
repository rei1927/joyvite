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
            // 1. Ambil pengaturan form menjadi Object JSON
            var formData = new FormData(form);
            var settings = {};
            
            // Ekstrak data teks dan unggah file secara simultan jika ada
            for (let [key, value] of formData.entries()) {
                if (value instanceof File && value.name) {
                    // Upload file terpisah ke API MinIO kita
                    let fileData = new FormData();
                    fileData.append('file', value);
                    
                    const uploadRes = await fetch('http://localhost:3000/api/upload', {
                        method: 'POST',
                        body: fileData
                    });
                    const uploadJson = await uploadRes.json();
                    if(uploadJson.url) {
                         settings[key] = uploadJson.url; // Ganti File menjadi URL S3
                    }
                } else if (!(value instanceof File)) {
                    settings[key] = value;
                }
            }

            // 2. Kirim seluruh JSON ke pangkalan data PostgreSQL
            const dbRes = await fetch('http://localhost:3000/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: 'reiza-wedding', settings: settings })
            });

            if (!dbRes.ok) throw new Error('Gagal menyimpan ke pangkalan data HTTP ' + dbRes.status);
            
            // Animasi transisi sukses
            btn.html('<i class="fa-solid fa-check me-2"></i>Tersimpan');
            btn.removeClass('btn-primary').addClass('btn-success');
            
            setTimeout(function() {
                btn.html(originalText);
                btn.removeClass('btn-success').addClass('btn-primary');
                btn.prop('disabled', false);
            }, 2000);
            
        } catch (error) {
            console.error('Error Integrasi Backend:', error);
            alert('Terjadi kesalahan dari Server. Pastikan Backend di port 3000 menyala! (' + error.message + ')');
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
