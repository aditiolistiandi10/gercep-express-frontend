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


// 🌐 ENDPOINT MANAGEMENT
const API_URL = "http://98.86.71.222:5000";// ⚠️ SILAHKAN GANTI URL DI BAWAH INI DENGAN INVOKE URL DARI API GATEWAY (LAMBDA) KAMU
const LAMBDA_API_URL = "https://xyz12345.execute-api.us-east-1.amazonaws.com/prod/shipment";


// ===== NEW API DATA MANAGER (INTEGRASI MULTI-AWS SERVICE) =====
var DB = {
  // 1. Mengambil seluruh data pengiriman dari server AWS EC2
  getAll: async function() {
    try {
      var response = await fetch(`${EC2_API_URL}/pengiriman`);
      if (!response.ok) throw new Error('HTTP error ' + response.status);
      var result = await response.json();
      return result.data; 
    } catch(e) {
      console.error("Gagal mengambil data dari AWS EC2:", e);
      return [];
    }
  },

  // 2. Mengirim data transaksi baru ke AWS Lambda + DynamoDB
  addPengiriman: async function(data) {
    try {
      var response = await fetch(LAMBDA_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) throw new Error('HTTP error ' + response.status);
      var result = await response.json();
      
      showToast(result.message || "Data terkirim ke AWS!", "success");
      // Mengembalikan data paket yang berhasil dibuat (atau fallback ke data input jika Lambda hanya merespon teks sukses)
      return result.newItem || data;
    } catch(e) {
      console.error("Gagal mengirim data ke AWS Lambda:", e);
      showToast("Gagal mengirim data ke cloud!", "error");
      return null;
    }
  },

  // 3. Mengubah status paket (Pending / Transit / Delivered) di database AWS EC2
  updateStatus: async function(resi, status) {
    try {
      var response = await fetch(`${EC2_API_URL}/pengiriman/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resi: resi, status: status })
      });
      return response.ok;
    } catch(e) {
      console.error("Gagal update status di AWS EC2:", e);
      return false;
    }
  },

  // 4. Menghapus data transaksi dari AWS EC2
  deletePengiriman: async function(resi) {
    try {
      var response = await fetch(`${EC2_API_URL}/pengiriman/${resi}`, { method: 'DELETE' });
      return response.ok;
    } catch(e) {
      console.error("Gagal menghapus data di AWS EC2:", e);
      return false;
    }
  },

  // 5. Mengambil ringkasan statistik (pendapatan, jumlah paket) untuk halaman Laporan dari AWS EC2
  stats: async function() {
    try {
      var response = await fetch(`${EC2_API_URL}/stats`);
      if (!response.ok) throw new Error('HTTP error ' + response.status);
      var result = await response.json();
      return result.analytics; 
    } catch(e) {
      console.error("Gagal memuat statistik AWS EC2:", e);
      return { total: 0, todayTotal: 0, delivered: 0, transit: 0, pending: 0, revenue: 0 };
    }
  }
};

// Hitung ongkir
function hitungOngkirCalc(berat, panjang, lebar, tinggi, layanan) {
  var beratVol  = (panjang * lebar * tinggi) / 6000;
  var beratTagih = Math.max(parseFloat(berat) || 0, beratVol, 0.1);
  var rates = { regular: 7000, express: 12000, sameday: 18000 };
  return { ongkir: Math.ceil(beratTagih) * rates[layanan], beratTagih: beratTagih };
}