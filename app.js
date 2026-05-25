// ===== GERCEP EXPRESS — app.js =====

// Toggle sidebar mobile
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Format rupiah
function formatRp(n) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

// Format tanggal Indonesia
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// Toast notifikasi
function showToast(msg, type) {
  type = type || 'success';
  document.querySelectorAll('.toast-notif').forEach(function(t) { t.remove(); });
  var t = document.createElement('div');
  t.className = 'toast-notif';
  t.textContent = msg;
  t.style.cssText = [
    'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9999',
    'background:' + (type === 'success' ? '#10B981' : '#EF4444'),
    'color:#fff', 'padding:12px 20px', 'border-radius:10px',
    'font-size:13.5px', 'font-weight:600',
    'box-shadow:0 4px 20px rgba(0,0,0,0.2)',
    'animation:slideUp .3s ease',
    "font-family:'Space Grotesk',sans-serif"
  ].join(';');
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 3000);
}

// ===== localStorage DATA MANAGER =====
var DB = {
  KEY: 'gercep_express_data',

  getAll: function() {
    try {
      var raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : this._defaultData();
    } catch(e) { return this._defaultData(); }
  },

  saveAll: function(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  _defaultData: function() {
    return {
      pengiriman: [
        {
          id:'1', resi:'GE-20240521-001', tanggal:'2024-05-21T08:30:00',
          pengirim:'Budi Santoso', telp_pengirim:'081234567890',
          alamat_pengirim:'Jl. Sudirman No.1', kota_asal:'Jakarta',
          penerima:'Dewi Lestari', telp_penerima:'082345678901',
          alamat_penerima:'Jl. Pemuda No.5', kota_tujuan:'Surabaya',
          barang:'Elektronik', kategori:'Elektronik', berat:2.5,
          layanan:'regular', status:'delivered', ongkir:17500, total:19500,
          nilai_barang:500000, catatan:'Fragile', estimasi:'2024-05-23'
        },
        {
          id:'2', resi:'GE-20240521-002', tanggal:'2024-05-21T09:00:00',
          pengirim:'Siti Rahayu', telp_pengirim:'083456789012',
          alamat_pengirim:'Jl. Braga No.10', kota_asal:'Bandung',
          penerima:'Ahmad Fauzi', telp_penerima:'084567890123',
          alamat_penerima:'Jl. Asia No.20', kota_tujuan:'Medan',
          barang:'Pakaian', kategori:'Pakaian', berat:1.2,
          layanan:'express', status:'transit', ongkir:14400, total:15400,
          nilai_barang:200000, catatan:'', estimasi:'2024-05-22'
        },
        {
          id:'3', resi:'GE-20240521-003', tanggal:'2024-05-21T09:30:00',
          pengirim:'Agus Wijaya', telp_pengirim:'085678901234',
          alamat_pengirim:'Jl. Diponegoro No.15', kota_asal:'Surabaya',
          penerima:'Rina Susanti', telp_penerima:'086789012345',
          alamat_penerima:'Jl. Dago No.8', kota_tujuan:'Bandung',
          barang:'Makanan Kering', kategori:'Makanan', berat:3.8,
          layanan:'sameday', status:'pending', ongkir:68400, total:70400,
          nilai_barang:300000, catatan:'Jangan ditumpuk', estimasi:'2024-05-21'
        },
        {
          id:'4', resi:'GE-20240521-004', tanggal:'2024-05-21T10:00:00',
          pengirim:'Dewi Lestari', telp_pengirim:'082345678901',
          alamat_pengirim:'Jl. Pemuda No.5', kota_asal:'Makassar',
          penerima:'Hendra Gunawan', telp_penerima:'087890123456',
          alamat_penerima:'Jl. MH Thamrin No.1', kota_tujuan:'Jakarta',
          barang:'Dokumen', kategori:'Dokumen', berat:0.8,
          layanan:'regular', status:'delivered', ongkir:5600, total:7600,
          nilai_barang:50000, catatan:'Rahasia', estimasi:'2024-05-24'
        },
        {
          id:'5', resi:'GE-20240521-005', tanggal:'2024-05-21T10:30:00',
          pengirim:'Rudi Hartono', telp_pengirim:'088901234567',
          alamat_pengirim:'Jl. Malioboro No.7', kota_asal:'Yogyakarta',
          penerima:'Maya Sari', telp_penerima:'089012345678',
          alamat_penerima:'Jl. Pandanaran No.3', kota_tujuan:'Semarang',
          barang:'Kerajinan Tangan', kategori:'Lainnya', berat:5.0,
          layanan:'express', status:'transit', ongkir:60000, total:61000,
          nilai_barang:400000, catatan:'', estimasi:'2024-05-22'
        }
      ]
    };
  },

  addPengiriman: function(data) {
    var db = this.getAll();
    var resi = 'GE-' + new Date().toISOString().slice(0,10).replace(/-/g,'') +
               '-' + String(Math.floor(Math.random()*900+100));
    var newItem = Object.assign({
      id: Date.now().toString(),
      resi: resi,
      tanggal: new Date().toISOString(),
      status: 'pending'
    }, data);
    db.pengiriman.unshift(newItem);
    this.saveAll(db);
    return newItem;
  },

  updateStatus: function(resi, status) {
    var db = this.getAll();
    var idx = db.pengiriman.findIndex(function(p) { return p.resi === resi; });
    if (idx >= 0) {
      db.pengiriman[idx].status = status;
      this.saveAll(db);
      return true;
    }
    return false;
  },

  deletePengiriman: function(resi) {
    var db = this.getAll();
    db.pengiriman = db.pengiriman.filter(function(p) { return p.resi !== resi; });
    this.saveAll(db);
  },

  stats: function() {
    var db = this.getAll();
    var today = new Date().toISOString().slice(0,10);
    var todayOrders = db.pengiriman.filter(function(p) {
      return p.tanggal.startsWith(today);
    });
    return {
      total:      db.pengiriman.length,
      todayTotal: todayOrders.length,
      delivered:  db.pengiriman.filter(function(p) { return p.status === 'delivered'; }).length,
      transit:    db.pengiriman.filter(function(p) { return p.status === 'transit';   }).length,
      pending:    db.pengiriman.filter(function(p) { return p.status === 'pending';   }).length,
      revenue:    db.pengiriman.reduce(function(s, p) { return s + (p.total || 0); }, 0),
    };
  }
};

// Hitung ongkir (dipakai di pengiriman.html)
function hitungOngkirCalc(berat, panjang, lebar, tinggi, layanan) {
  var beratVol  = (panjang * lebar * tinggi) / 6000;
  var beratTagih = Math.max(parseFloat(berat) || 0, beratVol, 0.1);
  var rates = { regular: 7000, express: 12000, sameday: 18000 };
  return { ongkir: Math.ceil(beratTagih) * rates[layanan], beratTagih: beratTagih };
}
