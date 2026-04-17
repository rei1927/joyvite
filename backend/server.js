require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { PrismaClient } = require('@prisma/client');
const { compileTemplate } = require('./joyvite-engine');

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
    
    const result = await prisma.weddingConfig.upsert({
      where: { slug: slug || 'default' },
      update: { settings, ...(template && { template }) },
      create: { slug: slug || 'default', settings, template }
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Joyvite Backend terhubung di port ${PORT}`));
