require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { PrismaClient } = require('@prisma/client');

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
    const { slug, settings } = req.body;
    
    const result = await prisma.weddingConfig.upsert({
      where: { slug: slug || 'default' },
      update: { settings },
      create: { slug: slug || 'default', settings }
    });
    
    res.json({ message: 'Settings saved successfully', data: result });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Joyvite Backend terhubung di port ${PORT}`));
