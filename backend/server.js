require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { PrismaClient } = require('@prisma/client');
const { compileTemplate } = require('./joyvite-engine');
const path = require('path');
const fs = require('fs');

const app = express();
const prisma = new PrismaClient();

// Middlewares
app.use(cors());
app.use(express.json());

// S3 Client Configuration (MinIO)
const s3Client = new S3Client({
  endpoint: `https://${process.env.MINIO_ENDPOINT}`,
  region: 'us-east-1', // MinIO default
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY
  },
  forcePathStyle: true // Needed for MinIO mapping pattern
});

// Multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

// --- ROUTES ---

// Healthcheck
app.get('/api/ping', (req, res) => res.json({ status: 'ok' }));

// Upload File Route
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    
    // Generate unique filename
    const fileName = `joyvite-${Date.now()}-${req.file.originalname}`;
    
    const params = {
      Bucket: 'joyvite-assets',
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };
    
    await s3Client.send(new PutObjectCommand(params));
    
    res.json({
      message: 'Upload success',
      url: `https://${process.env.MINIO_ENDPOINT}/joyvite-assets/${fileName}`
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save Config Settings Route (Using JSONB)
app.post('/api/settings', async (req, res) => {
  try {
    const { slug, settings, template } = req.body;
    const targetSlug = slug || 'default';
    
    // Ambil data config lama
    const existingConfig = await prisma.weddingConfig.findUnique({
      where: { slug: targetSlug }
    });
    
    // Lakukan deep merge / shallow merge pada setting tingkat top-level (mempelai, events, dll)
    let mergedSettings = settings;
    if (existingConfig && existingConfig.settings) {
       mergedSettings = { ...existingConfig.settings, ...settings };
    }
    
    const result = await prisma.weddingConfig.upsert({
      where: { slug: targetSlug },
      update: { settings: mergedSettings, ...(template && { template }) },
      create: { slug: targetSlug, settings: mergedSettings, template }
    });
    
    res.json({ message: 'Settings saved successfully', data: result });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Config Settings Route
app.get('/api/settings/:slug', async (req, res) => {
  try {
    const config = await prisma.weddingConfig.findUnique({
      where: { slug: req.params.slug }
    });
    if (!config) return res.status(404).json({ error: 'Config not found' });
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// JOYVITE ENGINE: Render Undangan Dinamis (SSR)
// ============================================

// Middleware: Subdomain Routing
app.use((req, res, next) => {
  const host = req.hostname;
  
  // Jika akses langsung IP atau localhost, izinkan lewat
  if (!host || host === 'localhost' || host === '127.0.0.1' || host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return next();
  }

  // Jika domain adalah joyvite.id tapi BUKAN login.joyvite.id atau www.joyvite.id
  if (host.includes('.joyvite.id') && host !== 'login.joyvite.id' && host !== 'www.joyvite.id') {
    const slug = host.split('.')[0]; // contoh: reiza-amanda.joyvite.id -> reiza-amanda
    
    // Rewrite internal URL agar di-handle oleh route /invitation/:slug
    if (req.path === '/' || req.path === '') {
       req.url = `/invitation/${slug}`;
    }
  }
  
  next();
});

// SERVE STATIC DASHBOARD (login.joyvite.id atau localhost)
const dockerDashboardPath = path.join(__dirname, 'dashboard');
const localDashboardPath = path.join(__dirname, '..');
const dashboardPath = fs.existsSync(dockerDashboardPath) ? dockerDashboardPath : localDashboardPath;
app.use(express.static(dashboardPath));

// GET /invitation/:slug
// Flow: Ambil data dari DB → Compile template → Kirim HTML final
app.get('/invitation/:slug', async (req, res) => {
  try {
    const config = await prisma.weddingConfig.findUnique({
      where: { slug: req.params.slug }
    });

    if (!config) {
      return res.status(404).send('<h1>Undangan tidak ditemukan</h1>');
    }

    if (!config.template) {
      return res.status(400).send('<h1>Template belum dipilih</h1>');
    }

    const settings = config.settings || {};
    const compiledHtml = compileTemplate(config.template, settings);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(compiledHtml);

  } catch (error) {
    console.error('Engine Error:', error);
    res.status(500).send(`<h1>Terjadi kesalahan</h1><p>${error.message}</p>`);
  }
});

// ============================================
// PREVIEW ENGINE: Test tanpa database (Mock Data)
// ============================================
app.get('/preview/:template', (req, res) => {
  try {
    const templateSlug = req.params.template;

    // Mock data untuk testing
    const mockSettings = {
      mempelai: {
        male_name: "Reiza Rachmattullah",
        male_nickname: "Rei",
        male_father_name: "Bpk. Ahmad Fauzi",
        male_mother_name: "Ibu Siti Nurhaliza",
        male_family_sequence: "Putra Kedua",
        female_name: "Amanda Rawles",
        female_nickname: "Amanda",
        female_father_name: "Bpk. Budi Santoso",
        female_mother_name: "Ibu Rina Wati",
        female_family_sequence: "Putri Pertama",
        male_instagram: "reiza",
        female_instagram: "amanda"
      },
      events: [
        {
          type: "Akad Nikah",
          place_name: "Masjid Istiqlal Jakarta",
          location: "Jl. Taman Wijaya Kusuma, Ps. Baru, Jakarta Pusat",
          date: "2030-12-15",
          time_start: "08:00",
          time_end: "10:00",
          visible: true
        },
        {
          type: "Resepsi",
          place_name: "Hotel Mulia Senayan",
          location: "Jl. Asia Afrika Senayan, Jakarta Selatan",
          date: "2030-12-15",
          time_start: "11:00",
          until_finish: true,
          visible: true
        }
      ],
      quotes: {
        content: "Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu isteri-isteri dari jenismu sendiri, supaya kamu cenderung dan merasa tenteram kepadanya.",
        author: "(QS. Ar-Rum: 21)"
      },
      amplop: {
        bank_accounts: [
          { bank_name: "BRI", account_number: "1234567890123", account_holder: "Reiza" },
          { bank_name: "Mandiri", account_number: "9876543210", account_holder: "Amanda" }
        ]
      }
    };

    const compiledHtml = compileTemplate(templateSlug, mockSettings);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(compiledHtml);

  } catch (error) {
    console.error('Preview Error:', error);
    res.status(500).send(`<h1>Preview Error</h1><p>${error.message}</p>`);
  }
});

// ============================================
// POST PREVIEW: Render template dengan data custom
// ============================================
app.post('/api/preview', (req, res) => {
  try {
    const { template, settings } = req.body;
    if (!template) return res.status(400).json({ error: 'template slug required' });
    
    const compiledHtml = compileTemplate(template, settings || {});
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(compiledHtml);
  } catch (error) {
    console.error('Custom Preview Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LIST TEMPLATES: Daftar template yang tersedia
// ============================================
app.get('/api/templates', (req, res) => {
  const fs = require('fs');
  const TEMPLATES_DIR = process.env.TEMPLATES_DIR || './templates';
  try {
    const dirs = fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name)
      .sort();
    res.json({ count: dirs.length, templates: dirs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TEST PAGE: Form interaktif untuk test injeksi data
// ============================================
app.get('/test', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Joyvite - Test Injeksi Template</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #0f0f1a; color: #e0e0e0; min-height: 100vh; }
    
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 20px 30px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 15px; }
    .header h1 { font-size: 22px; font-weight: 700; background: linear-gradient(135deg, #e94560, #ff6b9d); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .header span { font-size: 13px; color: #666; }
    
    .container { display: grid; grid-template-columns: 420px 1fr; height: calc(100vh - 65px); }
    
    .form-panel { overflow-y: auto; padding: 20px; background: #12121f; border-right: 1px solid rgba(255,255,255,0.06); }
    .preview-panel { position: relative; background: #1a1a2e; }
    .preview-panel iframe { width: 100%; height: 100%; border: none; }
    .preview-overlay { position: absolute; top: 15px; right: 15px; z-index: 10; background: rgba(0,0,0,0.7); backdrop-filter: blur(10px); border-radius: 12px; padding: 8px 16px; font-size: 12px; color: #e94560; border: 1px solid rgba(233,69,96,0.3); }
    
    .section { margin-bottom: 24px; background: rgba(255,255,255,0.03); border-radius: 12px; padding: 18px; border: 1px solid rgba(255,255,255,0.06); }
    .section h3 { font-size: 14px; font-weight: 600; color: #e94560; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 1px; }
    
    .field { margin-bottom: 12px; }
    .field label { display: block; font-size: 12px; color: #888; margin-bottom: 5px; font-weight: 500; }
    .field input, .field select, .field textarea { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #e0e0e0; font-size: 14px; font-family: inherit; transition: all 0.2s; }
    .field input:focus, .field select:focus, .field textarea:focus { outline: none; border-color: #e94560; box-shadow: 0 0 0 3px rgba(233,69,96,0.15); }
    .field textarea { resize: vertical; min-height: 60px; }
    .field select { appearance: none; cursor: pointer; }
    
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    
    .btn { padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: all 0.2s; }
    .btn-primary { background: linear-gradient(135deg, #e94560, #c73659); color: white; width: 100%; font-size: 16px; padding: 14px; }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(233,69,96,0.3); }
    .btn-primary:active { transform: translateY(0); }
    
    .template-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; max-height: 200px; overflow-y: auto; }
    .template-card { padding: 10px; background: rgba(255,255,255,0.03); border: 2px solid transparent; border-radius: 8px; cursor: pointer; font-size: 12px; text-align: center; transition: all 0.2s; }
    .template-card:hover { border-color: rgba(233,69,96,0.3); background: rgba(233,69,96,0.05); }
    .template-card.active { border-color: #e94560; background: rgba(233,69,96,0.1); }
    
    .status-bar { padding: 10px 20px; background: rgba(0,0,0,0.3); font-size: 12px; color: #666; display: flex; justify-content: space-between; }
    
    @media (max-width: 900px) {
      .container { grid-template-columns: 1fr; }
      .preview-panel { height: 60vh; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>💌 Joyvite Engine</h1>
    <span>Template Injection Tester</span>
  </div>
  
  <div class="container">
    <div class="form-panel">
      <!-- TEMPLATE SELECTOR -->
      <div class="section">
        <h3>📋 Pilih Template</h3>
        <div class="field">
          <select id="templateSelect" onchange="updateTemplateCard()">
            <option value="">Loading templates...</option>
          </select>
        </div>
      </div>
      
      <!-- MEMPELAI -->
      <div class="section">
        <h3>💑 Data Mempelai</h3>
        <div class="row">
          <div class="field">
            <label>Nama Lengkap Pria</label>
            <input type="text" id="male_name" value="Reiza Rachmattullah">
          </div>
          <div class="field">
            <label>Nama Lengkap Wanita</label>
            <input type="text" id="female_name" value="Amanda Rawles">
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label>Nama Panggilan Pria</label>
            <input type="text" id="male_nickname" value="Rei">
          </div>
          <div class="field">
            <label>Nama Panggilan Wanita</label>
            <input type="text" id="female_nickname" value="Amanda">
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label>Ayah Pria</label>
            <input type="text" id="male_father" value="Bpk. Ahmad Fauzi">
          </div>
          <div class="field">
            <label>Ibu Pria</label>
            <input type="text" id="male_mother" value="Ibu Siti Nurhaliza">
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label>Ayah Wanita</label>
            <input type="text" id="female_father" value="Bpk. Budi Santoso">
          </div>
          <div class="field">
            <label>Ibu Wanita</label>
            <input type="text" id="female_mother" value="Ibu Rina Wati">
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label>Urutan Anak Pria</label>
            <input type="text" id="male_seq" value="Putra Kedua">
          </div>
          <div class="field">
            <label>Urutan Anak Wanita</label>
            <input type="text" id="female_seq" value="Putri Pertama">
          </div>
        </div>
      </div>
      
      <!-- ACARA 1 -->
      <div class="section">
        <h3>📍 Acara 1 (Akad/Pemberkatan)</h3>
        <div class="field">
          <label>Nama Tempat</label>
          <input type="text" id="event1_place" value="Masjid Istiqlal Jakarta">
        </div>
        <div class="row">
          <div class="field">
            <label>Tanggal</label>
            <input type="date" id="event1_date" value="2030-12-15">
          </div>
          <div class="field">
            <label>Jam Mulai</label>
            <input type="time" id="event1_time" value="08:00">
          </div>
        </div>
      </div>
      
      <!-- ACARA 2 -->
      <div class="section">
        <h3>📍 Acara 2 (Resepsi)</h3>
        <div class="field">
          <label>Nama Tempat</label>
          <input type="text" id="event2_place" value="Hotel Mulia Senayan">
        </div>
        <div class="row">
          <div class="field">
            <label>Tanggal</label>
            <input type="date" id="event2_date" value="2030-12-15">
          </div>
          <div class="field">
            <label>Jam Mulai</label>
            <input type="time" id="event2_time" value="11:00">
          </div>
        </div>
      </div>
      
      <!-- QUOTES -->
      <div class="section">
        <h3>📜 Quotes / Ayat</h3>
        <div class="field">
          <label>Kutipan</label>
          <textarea id="quotes">Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan dari jenismu sendiri, supaya kamu cenderung dan merasa tenteram kepadanya.</textarea>
        </div>
      </div>
      
      <!-- AMPLOP -->
      <div class="section">
        <h3>💰 Amplop Digital</h3>
        <div class="row">
          <div class="field">
            <label>Bank 1</label>
            <input type="text" id="bank1_name" value="BRI">
          </div>
          <div class="field">
            <label>No. Rekening 1</label>
            <input type="text" id="bank1_number" value="1234567890123">
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label>Bank 2</label>
            <input type="text" id="bank2_name" value="Mandiri">
          </div>
          <div class="field">
            <label>No. Rekening 2</label>
            <input type="text" id="bank2_number" value="9876543210">
          </div>
        </div>
      </div>
      
      <button class="btn btn-primary" onclick="renderPreview()">🚀 Render Preview</button>
      
      <div class="status-bar" id="status">
        <span>Siap digunakan</span>
        <span id="renderTime"></span>
      </div>
    </div>
    
    <div class="preview-panel">
      <div class="preview-overlay" id="previewLabel">Pilih template & klik Render</div>
      <iframe id="previewFrame" srcdoc="<body style='background:#1a1a2e;color:#666;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif'><p>Preview akan muncul di sini</p></body>"></iframe>
    </div>
  </div>
  
  <script>
    // Load available templates
    fetch('/api/templates')
      .then(r => r.json())
      .then(data => {
        const sel = document.getElementById('templateSelect');
        sel.innerHTML = data.templates.map(t => 
          '<option value="' + t + '"' + (t === 'tema-15-tanpa-foto' ? ' selected' : '') + '>' + t + '</option>'
        ).join('');
      });
    
    function renderPreview() {
      const template = document.getElementById('templateSelect').value;
      if (!template) { alert('Pilih template dulu!'); return; }
      
      const settings = {
        mempelai: {
          male_name: document.getElementById('male_name').value,
          female_name: document.getElementById('female_name').value,
          male_nickname: document.getElementById('male_nickname').value,
          female_nickname: document.getElementById('female_nickname').value,
          male_father_name: document.getElementById('male_father').value,
          male_mother_name: document.getElementById('male_mother').value,
          female_father_name: document.getElementById('female_father').value,
          female_mother_name: document.getElementById('female_mother').value,
          male_family_sequence: document.getElementById('male_seq').value,
          female_family_sequence: document.getElementById('female_seq').value,
        },
        events: [
          {
            type: 'Akad Nikah',
            place_name: document.getElementById('event1_place').value,
            date: document.getElementById('event1_date').value,
            time_start: document.getElementById('event1_time').value,
          },
          {
            type: 'Resepsi',
            place_name: document.getElementById('event2_place').value,
            date: document.getElementById('event2_date').value,
            time_start: document.getElementById('event2_time').value,
            until_finish: true,
          }
        ],
        quotes: { content: document.getElementById('quotes').value },
        amplop: {
          bank_accounts: [
            { bank_name: document.getElementById('bank1_name').value, account_number: document.getElementById('bank1_number').value },
            { bank_name: document.getElementById('bank2_name').value, account_number: document.getElementById('bank2_number').value },
          ]
        }
      };
      
      document.getElementById('previewLabel').textContent = '⏳ Rendering...';
      const start = Date.now();
      
      fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template, settings })
      })
      .then(r => r.text())
      .then(html => {
        const ms = Date.now() - start;
        document.getElementById('previewFrame').srcdoc = html;
        document.getElementById('previewLabel').textContent = '✅ ' + template;
        document.getElementById('renderTime').textContent = 'Render: ' + ms + 'ms';
      })
      .catch(err => {
        document.getElementById('previewLabel').textContent = '❌ Error: ' + err.message;
      });
    }
  </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Joyvite Backend terhubung di port ${PORT}`));
