# Dokumentasi Perbaikan Joyvite Engine (Adaptive Photo & Frame Lock)

**Tanggal:** 4 Mei 2026
**Fokus Masalah:** Rendering foto *user* di dalam template "Javanese Serenity" (Tema Art 14) agar pas sempurna (fit) di dalam bingkai (frame) coklat 3D tanpa bergeser saat diakses via HP, iPad/Tablet, maupun Desktop.

---

## 1. Latar Belakang Masalah
Template asli bawaan Elementor memiliki beberapa "cacat desain" bawaan yang membuatnya sulit untuk diinjeksi secara dinamis melalui backend NodeJS (Cheerio):
- **Cacat Responsif iPad:** Di versi bawaan, widget bingkai (frame) di-set dengan CSS `position: absolute; right: 0px`. Pada layar HP (Mobile), ini terlihat bagus. Namun pada layar iPad yang lebih lebar, bingkai tersebut tertarik menjauh ke kanan, meninggalkan foto yang diam di tengah.
- **Efek "Hole" Palsu:** Bingkai coklat tersebut ternyata **bukan** gambar PNG transparan berlubang tengah. Ia adalah gambar coklat pekat padat (solid). Efek "foto berada di dalam bingkai" didapat dari menumpuk foto **DI ATAS** bingkai coklat tersebut, lalu memotong foto tersebut menggunakan CSS `mask-image` (`-webkit-mask-size`) berbentuk gunungan agar tepiannya menyerupai bingkai.

## 2. Iterasi Perbaikan (Trial & Error)
Selama proses penyempurnaan, kita melewati beberapa fase:
1. **Pendekatan CSS Inline Sederhana (`scale 0.96`):** Kita mencoba hanya mengecilkan foto dan menambahkan `translateY(-4%)`. Berhasil di HP, tapi gagal di iPad karena jarak widget yang menjauh.
2. **Pendekatan Penggabungan Paksa (DOM Lock v1):** Kita mencoba melebur bingkai ke dalam kotak foto dan menaruh bingkai di lapisan paling atas (`z-index: 10`). Gagal total karena bingkai ternyata solid coklat padat, menutupi foto sepenuhnya dan menjadi raksasa.
3. **Pencarian Skala Sempurna:** Kita kebingungan mencari persentase yang pas (`scale 0.82`, `scale 0.93`, dll) karena lebar foto dihitung berdasarkan *column* (kolom) Elementor yang melebar tak terhingga.
4. **Solusi Emas dari Inspector (DevTools):** *User* melakukan *tweak* manual di Chrome Inspector dan menemukan angka emas perbandingan: **Bingkai = 55%** dan **Foto = 53%**.

## 3. Solusi Final (Metode "Absolute DOM Locking")
Solusi paling *bulletproof* (kebal peluru) diterapkan di dalam fungsi `applyAdaptiveStyle` pada file `backend/joyvite-engine.js`.

**Cara Kerja Engine Final:**
1. Engine mencari gambar yang mengandung kata `frame` atau `bingkai` di dalam satu Container/Section yang sama dengan foto user.
2. Engine **mengkloning (menyalin) gambar bingkai tersebut** dan menaruhnya tepat di belakang foto user (`z-index: 0`) di dalam satu `.elementor-widget-container` yang sama.
3. Bingkai kloningan ini dijadikan sebagai "Pondasi Ukuran" (Relative Anchor) dengan lebar mutlak **55%**.
4. Foto user kemudian diubah menjadi "Parasit" yang melayang absolut (`position: absolute`) tepat di atas bingkai tersebut (`z-index: 1`) dan dipaksa ke titik tengah (`top: 50%`, `left: 50%`).
5. Karena pondasinya 55%, foto user di-set sedikit lebih kecil, yakni **53%**. (Inilah rahasia mengapa foto kini pas dengan cantik di garis dalam bingkai coklat).
6. Terakhir, Engine **menghapus secara permanen widget bingkai asli** bawaan Elementor agar tidak terjadi duplikasi dan mengatasi *bug* "lari ke kanan" di iPad.

## 4. Snippet Kode Final (Referensi)
Bagian paling krusial di `joyvite-engine.js`:

```javascript
// 1. Jadikan container foto relative
$photoContainer.attr('style', ($photoContainer.attr('style') || '') + ' position: relative !important; display: flex; justify-content: center; align-items: center;');

// 2. Kloning frame dan jadikan pondasi (ukuran 55%)
const $clonedFrame = $frameImg.clone();
$clonedFrame.attr('style', 'width: 55% !important; height: auto !important; position: relative !important; z-index: 0 !important; display: block !important;');

// 3. Masukkan frame ke belakang foto
$photoContainer.prepend($clonedFrame);

// 4. Set foto melayang di titik tengah, ukuran 53%
$img.attr('style', `position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; width: 53% !important; height: auto !important; z-index: 1 !important; object-fit: cover !important; aspect-ratio: ${targetW}/${targetH} !important; -webkit-mask-size: 100% 100% !important; mask-size: 100% 100% !important;`);

// 5. Hapus widget asli
$frameWidget.remove();
```

## 5. Prosedur Deploy (Hot-Patch Proxmox)
Setiap kali ada pembaruan di file `joyvite-engine.js`, jalankan *command* wajib ini di terminal server (Proxmox/Docker) untuk memaksa kontainer menarik versi terbaru tanpa harus me-*rebuild* image dari nol:

```bash
cd /tmp && \
rm -rf joyvite-update && \
git clone https://github.com/rei1927/joyvite.git joyvite-update && \
docker cp joyvite-update/backend/joyvite-engine.js joyvite-backend:/app/joyvite-engine.js && \
docker restart joyvite-backend
```

---
*Catatan untuk AI selanjutnya: Serahkan file ini untuk mendapatkan konteks penuh mengenai cara kerja rendering foto adaptif di Joyvite Engine dan mengapa struktur DOM "DOM Locking" dengan proporsi 55% vs 53% harus selalu dipertahankan.*
