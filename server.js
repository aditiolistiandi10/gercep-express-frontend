// ============================================================
// GERCEP EXPRESS — Backend API v2.0 (FIXED FOR FRONTEND)
// Node.js + Express + MySQL + JWT Auth
// ============================================================

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const mysql      = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const rateLimit  = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 5000;

// ===== MIDDLEWARE =====
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// MEMASTIKAN CORS TERBUKA UNTUK FRONTEND LOKAL
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// ===== DATABASE POOL =====
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'mysql',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'gercep_user',
  password:           process.env.DB_PASSWORD || 'gercep_pass',
  database:           process.env.DB_NAME     || 'gercep_express',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  connectTimeout:     30000,
});

// ===== JWT MIDDLEWARE =====
const JWT_SECRET = process.env.JWT_SECRET || 'gercep_secret_2024';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kadaluarsa' });
  }
}

function roleMiddleware(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Akses tidak diizinkan' });
    }
    next();
  };
}

// ===== HELPERS =====
function generateResi() {
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const rand  = Math.floor(Math.random() * 900 + 100);
  return `GE-${today}-${rand}`;
}

function hitungOngkir(berat, panjang, lebar, tinggi, layanan) {
  const beratVol  = (panjang * lebar * tinggi) / 6000;
  const beratTagih = Math.max(parseFloat(berat) || 0, beratVol);
  const rates = { regular: 7000, express: 12000, sameday: 18000 };
  return Math.ceil(beratTagih) * (rates[layanan] || rates.regular);
}

function getEstimasi(layanan) {
  const days = { regular: 3, express: 1, sameday: 0 };
  const d = new Date();
  d.setDate(d.getDate() + (days[layanan] ?? 3));
  return d.toISOString().slice(0,10);
}

// ===== HEALTH CHECK =====
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'Gercep Express API', db: 'connected', version: '2.0.0', timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', service: 'Gercep Express API', db: 'disconnected' });
  }
});

// ===========================
// AUTH ROUTES
// ===========================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nama, email, password, telepon, alamat, kota, role } = req.body;
    if (!nama || !email || !password)
      return res.status(400).json({ success: false, message: 'Nama, email, dan password wajib diisi' });

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar' });

    const allowedRoles = ['user', 'kurir'];
    const userRole = allowedRoles.includes(role) ? role : 'user';
    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (nama, email, password, telepon, alamat, kota, role) VALUES (?,?,?,?,?,?,?)',
      [nama, email, hash, telepon||'', alamat||'', kota||'', userRole]
    );

    const token = jwt.sign({ id: result.insertId, nama, email, role: userRole }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ success: true, message: 'Registrasi berhasil', token, user: { id: result.insertId, nama, email, role: userRole } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal registrasi' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi' });

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
    if (rows.length === 0)
      return res.status(401).json({ success: false, message: 'Email atau password salah' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Email atau password salah' });

    const token = jwt.sign({ id: user.id, nama: user.nama, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true, message: 'Login berhasil', token,
      user: { id: user.id, nama: user.nama, email: user.email, telepon: user.telepon, kota: user.kota, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal login' });
  }
});

app.get('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, nama, email, telepon, alamat, kota, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal ambil profil' });
  }
});

// ===========================
// PENGIRIMAN ROUTES
// ===========================
app.get('/api/pengiriman', authMiddleware, async (req, res) => {
  try {
    const { status, layanan, search, page = 1, limit = 20 } = req.query;
    let where = [];
    let params = [];

    if (req.user.role === 'user') {
      where.push('p.user_id = ?');
      params.push(req.user.id);
    } else if (req.user.role === 'kurir') {
      where.push('(p.kurir_id = ? OR p.kurir_id IS NULL)');
      params.push(req.user.id);
    }

    if (status)  { where.push('p.status = ?');  params.push(status); }
    if (layanan) { where.push('p.layanan = ?'); params.push(layanan); }
    if (search)  {
      where.push('(p.resi LIKE ? OR p.nama_pengirim LIKE ? OR p.nama_penerima LIKE ? OR p.kota_tujuan LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }

    const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset   = (parseInt(page) - 1) * parseInt(limit);

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM pengiriman p ${whereStr}`, params);
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT p.*, u.nama as user_nama, k.nama as kurir_nama
       FROM pengiriman p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN users k ON k.id = p.kurir_id
       ${whereStr}
       ORDER BY p.tanggal_dibuat DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ success: true, data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal ambil data pengiriman' });
  }
});

app.get('/api/pengiriman/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, u.nama as user_nama, k.nama as kurir_nama
       FROM pengiriman p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN users k ON k.id = p.kurir_id
       WHERE p.id = ? OR p.resi = ?`,
      [req.params.id, req.params.id.toUpperCase()]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Pengiriman tidak ditemukan' });

    const pengiriman = rows[0];
    const [riwayat] = await pool.query(
      'SELECT * FROM riwayat_pengiriman WHERE pengiriman_id = ? ORDER BY created_at DESC',
      [pengiriman.id]
    );
    pengiriman.riwayat = riwayat;
    res.json({ success: true, data: pengiriman });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal ambil detail pengiriman' });
  }
});

app.post('/api/pengiriman', authMiddleware, async (req, res) => {
  try {
    const {
      nama_pengirim, telp_pengirim, alamat_pengirim, kota_asal, kodepos_asal,
      nama_penerima, telp_penerima, alamat_penerima, kota_tujuan, kodepos_tujuan,
      nama_barang, kategori, berat, panjang = 0, lebar = 0, tinggi = 0,
      nilai_barang = 0, catatan, layanan
    } = req.body;

    if (!nama_pengirim || !telp_pengirim || !alamat_pengirim || !kota_asal ||
        !nama_penerima || !telp_penerima || !alamat_penerima || !kota_tujuan ||
        !nama_barang || !berat || !layanan)
      return res.status(400).json({ success: false, message: 'Data tidak lengkap' });

    const resi      = generateResi();
    const ongkir    = hitungOngkir(berat, panjang, lebar, tinggi, layanan);
    const asuransi  = Math.round(parseFloat(nilai_barang) * 0.002);
    const total     = ongkir + asuransi + 2000;
    const estimasi  = getEstimasi(layanan);

    const [result] = await pool.query(
      `INSERT INTO pengiriman
       (resi, user_id, nama_pengirim, telp_pengirim, alamat_pengirim, kota_asal, kodepos_asal,
        nama_penerima, telp_penerima, alamat_penerima, kota_tujuan, kodepos_tujuan,
        nama_barang, kategori, berat, panjang, lebar, tinggi, nilai_barang, catatan,
        layanan, ongkir, asuransi, biaya_admin, total, status, estimasi_tiba)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,2000,?,?,?)`,
      [resi, req.user.id, nama_pengirim, telp_pengirim, alamat_pengirim, kota_asal, kodepos_asal||'',
       nama_penerima, telp_penerima, alamat_penerima, kota_tujuan, kodepos_tujuan||'',
       nama_barang, kategori||'Lainnya', berat, panjang, lebar, tinggi, nilai_barang, catatan||'',
       layanan, ongkir, asuransi, total, 'pending', estimasi]
    );

    await pool.query(
      'INSERT INTO riwayat_pengiriman (pengiriman_id, status_label, lokasi, keterangan) VALUES (?,?,?,?)',
      [result.insertId, 'Pesanan Dibuat', 'System', 'Pengiriman berhasil didaftarkan ke sistem Gercep Express']
    );

    res.status(201).json({
      success: true, message: 'Pengiriman berhasil dibuat',
      data: { id: result.insertId, resi, ongkir, asuransi, total, estimasi_tiba: estimasi }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal membuat pengiriman' });
  }
});

app.put('/api/pengiriman/:id/status', authMiddleware, roleMiddleware('kurir', 'admin'), async (req, res) => {
  try {
    const { status, lokasi, keterangan } = req.body;
    const validStatuses = ['pending','pickup','transit','delivered','cancel'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: 'Status tidak valid' });

    const [rows] = await pool.query('SELECT * FROM pengiriman WHERE id = ? OR resi = ?', [req.params.id, req.params.id.toUpperCase()]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Pengiriman tidak ditemukan' });

    const p = rows[0];
    const statusLabels = { pending:'Menunggu Pickup', pickup:'Paket Diambil', transit:'Dalam Perjalanan', delivered:'Paket Diterima', cancel:'Dibatalkan' };

    let extra = '';
    if (status === 'delivered') extra = ', tanggal_diterima = NOW()';
    if (status === 'pickup')    extra = ', tanggal_dikirim = NOW(), kurir_id = ?';

    if (status === 'pickup') {
      await pool.query(`UPDATE pengiriman SET status = ? ${extra} WHERE id = ?`, [status, req.user.id, p.id]);
    } else {
      await pool.query(`UPDATE pengiriman SET status = ? ${extra} WHERE id = ?`, [status, p.id]);
    }

    await pool.query(
      'INSERT INTO riwayat_pengiriman (pengiriman_id, status_label, lokasi, keterangan) VALUES (?,?,?,?)',
      [p.id, statusLabels[status], lokasi||'Unknown', keterangan||'']
    );

    res.json({ success: true, message: 'Status berhasil diperbarui' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal update status' });
  }
});

app.delete('/api/pengiriman/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pengiriman WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Tidak ditemukan' });

    const p = rows[0];
    if (req.user.role === 'user' && p.user_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Bukan milik Anda' });

    if (p.status !== 'pending')
      return res.status(400).json({ success: false, message: 'Hanya bisa batalkan yang masih pending' });

    await pool.query('UPDATE pengiriman SET status = ? WHERE id = ?', ['cancel', p.id]);
    await pool.query(
      'INSERT INTO riwayat_pengiriman (pengiriman_id, status_label, lokasi, keterangan) VALUES (?,?,?,?)',
      [p.id, 'Dibatalkan', 'System', 'Pengiriman dibatalkan oleh pengguna']
    );
    res.json({ success: true, message: 'Pengiriman berhasil dibatalkan' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal batalkan pengiriman' });
  }
});

// ============================================================
// PERBAIKAN UTAMA: ENDPOINT SINKRON UNTUK FRONTEND LACAK RESI
// ============================================================
// Berjalan di rute /api/lacak/:resi ATAU /api/awb/:resi agar dua-duanya jalan!
const lacakHandler = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pengiriman WHERE resi = ?', [req.params.resi.toUpperCase()]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Nomor resi tidak ditemukan' });

    const p = rows[0];
    const [riwayat] = await pool.query(
      'SELECT * FROM riwayat_pengiriman WHERE pengiriman_id = ? ORDER BY created_at DESC', [p.id]
    );

    // Kirim response flat langsung + format lama (Double support)
    res.json({
      success: true,
      resi: p.resi, 
      status: p.status,
      pengirim: p.nama_pengirim,
      penerima: p.nama_penerima,
      kota_asal: p.kota_asal,
      kota_tujuan: p.kota_tujuan,
      layanan: p.layanan, 
      berat: p.berat,
      estimasi_tiba: p.estimasi_tiba,
      tanggal: p.tanggal_dibuat,
      data: {
        resi: p.resi, status: p.status,
        pengirim: { nama: p.nama_pengirim, kota: p.kota_asal },
        penerima: { nama: p.nama_penerima, kota: p.kota_tujuan },
        layanan: p.layanan, estimasi_tiba: p.estimasi_tiba,
        tanggal_dibuat: p.tanggal_dibuat, riwayat
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal lacak paket' });
  }
};

app.get('/api/lacak/:resi', lacakHandler);
app.get('/api/awb/:resi', lacakHandler); // <-- ALIAS BARU BIAR SYNC DENGAN FETCH FRONTEND

// ===========================
// STATISTIK DASHBOARD
// ===========================
app.get('/api/statistik', authMiddleware, async (req, res) => {
  try {
    let whereUser = '';
    let params = [];
    if (req.user.role === 'user') {
      whereUser = 'WHERE user_id = ?';
      params.push(req.user.id);
    }

    const [totalRows]     = await pool.query(`SELECT COUNT(*) as c FROM pengiriman ${whereUser}`, params);
    const [deliveredRows] = await pool.query(`SELECT COUNT(*) as c FROM pengiriman ${whereUser ? whereUser + ' AND' : 'WHERE'} status = 'delivered'`, [...params]);
    const [transitRows]   = await pool.query(`SELECT COUNT(*) as c FROM pengiriman ${whereUser ? whereUser + ' AND' : 'WHERE'} status = 'transit'`, [...params]);
    const [pendingRows]   = await pool.query(`SELECT COUNT(*) as c FROM pengiriman ${whereUser ? whereUser + ' AND' : 'WHERE'} status = 'pending'`, [...params]);
    const [revenueRows]   = await pool.query(`SELECT COALESCE(SUM(total),0) as c FROM pengiriman ${whereUser ? whereUser + ' AND' : 'WHERE'} status != 'cancel'`, [...params]);

    const today = new Date().toISOString().slice(0, 10);
    const todayWhere = whereUser ? `${whereUser} AND DATE(tanggal_dibuat) = ?` : `WHERE DATE(tanggal_dibuat) = ?`;
    const [todayRows] = await pool.query(`SELECT COUNT(*) as c FROM pengiriman ${todayWhere}`, [...params, today]);

    res.json({
      success: true,
      data: {
        total:      totalRows[0].c,
        delivered:  deliveredRows[0].c,
        transit:    transitRows[0].c,
        pending:    pendingRows[0].c,
        revenue:    revenueRows[0].c,
        today:      todayRows[0].c,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal ambil statistik' });
  }
});

// ===========================
// HITUNG ONGKIR (PUBLIC)
// ===========================
app.post('/api/hitung-ongkir', (req, res) => {
  const { berat, panjang = 0, lebar = 0, tinggi = 0, layanan } = req.body;
  if (!berat || !layanan)
    return res.status(400).json({ success: false, message: 'Berat dan layanan wajib diisi' });

  const beratVol   = (panjang * lebar * tinggi) / 6000;
  const beratTagih = Math.max(parseFloat(berat), beratVol);
  const rates = { regular: 7000, express: 12000, sameday: 18000 };
  const ongkir = Math.ceil(beratTagih) * (rates[layanan] || rates.regular);

  res.json({ success: true, data: { beratAktual: berat, beratVolumetrik: +beratVol.toFixed(2), beratTagih: +beratTagih.toFixed(2), ongkir, layanan } });
});

// ===========================
// KURIR: AMBIL PENGIRIMAN
// ===========================
app.get('/api/kurir/tersedia', authMiddleware, roleMiddleware('kurir', 'admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM pengiriman WHERE status = 'pending' ORDER BY tanggal_dibuat DESC LIMIT 50"
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal ambil data' });
  }
});

// ===== 404 & ERROR HANDLER =====
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
});
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`\n⚡ Gercep Express API v2.0 running on port ${PORT}`);
  console.log("🔐 Auth: JWT enabled");
  console.log(`💾 DB:   MySQL @ ${process.env.DB_HOST || 'mysql'}:${process.env.DB_PORT || 3306}\n`);
});

module.exports = app;