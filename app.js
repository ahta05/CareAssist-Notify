import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, onValue, push, remove, update, get, query, orderByChild, startAt, endAt } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// Firebase config (standarisasi: gunakan yang sama di semua file)
const firebaseConfig = {
  apiKey: "AIzaSyBiRnmrJwnYGdKtX5DR4mcsgsf_wkTo_V4",
  authDomain: "careassist-notify.firebaseapp.com",
  databaseURL: "https://careassist-notify-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "careassist-notify",
  storageBucket: "careassist-notify.firebasestorage.app",
  messagingSenderId: "279878356808",
  appId: "1:279878356808:web:08e40763159a4aad152d7d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// DOM
const activeList = document.getElementById('active-list');
const handledList = document.getElementById('handled-list');
const historyTable = document.getElementById('history-table');

// =======================
// FUNGSI UNTUK MODAL KONFIRMASI KUSTOM
// =======================
function showConfirmModal(message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  const modalBody = modal.querySelector('.modal-body p');
  modalBody.textContent = message; // Ubah pesan di modal
  modal.style.display = 'flex';
  
  const confirmBtn = document.getElementById('confirm-delete-btn');
  // Hapus listener lama untuk mencegah duplikasi eksekusi
  confirmBtn.replaceWith(confirmBtn.cloneNode(true)); 
  const newConfirmBtn = document.getElementById('confirm-delete-btn');
  
  newConfirmBtn.addEventListener('click', () => {
    onConfirm(); // Jalankan fungsi hapus
    closeConfirmModal();
  });
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').style.display = 'none';
}

// =======================
// CARD BUILDER (VERSI YANG SUDAH DIPERBAIKI)
// =======================
function buildCard(room, key, alert) {
  const ts = new Date(alert.createdAt).toLocaleString();
  const card = document.createElement('div');
  
  // Tambah class warna berdasarkan type
  const colorClass = alert.type === 'infus' ? 'red' : alert.type === 'nonmedis' ? 'white' : alert.type === 'medis' ? 'yellow' : '';
  card.className = `card ${colorClass} ${alert.status === 'Ditangani' ? 'handled' : 'active'}`;

  // PERBAIKAN: Buat struktur HTML yang sesuai dengan CSS
  card.innerHTML = `
    <div class="details">
      <div class="row">
        <span class="label">Ruang</span>
        <span class="colon">:</span>
        <span class="value">${room.replace('room_', '')}</span>
      </div>
      <div class="row">
        <span class="label">Jenis</span>
        <span class="colon">:</span>
        <span class="value">${alert.type}</span>
      </div>
      <div class="row">
        <span class="label">Status</span>
        <span class="colon">:</span>
        <span class="value">${alert.status || 'Aktif'}</span>
      </div>
      <div class="row">
        <span class="label">Waktu</span>
        <span class="colon">:</span>
        <span class="value">${ts}</span>
      </div>
      <div class="row">
        <span class="label">Pesan</span>
        <span class="colon">:</span>
        <span class="value">${alert.message || '-'}</span>
      </div>
    </div>
    <div class="footer">
      <button class="ack-btn" ${alert.status === 'Ditangani' ? 'disabled' : ''}>
        ${alert.status === 'Ditangani' ? 'Ditangani' : 'Tangani'}
      </button>
    </div>
  `;

  if (alert.status !== 'Ditangani') {
    card.querySelector('.ack-btn').onclick = async () => {
      try {
        const now = Date.now();

        // Update ACTIVE → Ditangani
        await update(ref(db, `alerts_active/${room}/${key}`), {
          status: "Ditangani",
          handledAt: now
        });

        // Log ke HISTORY (immutable)
        await push(ref(db, `alerts_history/${room}`), {
          ...alert,
          status: "Ditangani",
          handledAt: now
        });

        // JANGAN hapus dari ACTIVE (agar card pindah ke handled list, bukan hilang)
        // await remove(ref(db, `alerts_active/${room}/${key}`));  // Dihapus agar tetap di active
      } catch (error) {
        console.error("Error handling alert:", error);
        alert("Gagal menangani alert. Coba lagi.");
      }
    };
  }

  return card;
}

// =======================
// MAIN LISTENER
// =======================
function listenAlerts() {
  onValue(ref(db, 'alerts_active'), snap => {
    activeList.innerHTML = '';
    handledList.innerHTML = '';

    const data = snap.val() || {};
    Object.entries(data).forEach(([room, alerts]) => {
      Object.entries(alerts || {}).forEach(([key, alert]) => {
        const card = buildCard(room, key, alert);
        alert.status === 'Ditangani'
          ? handledList.appendChild(card)
          : activeList.appendChild(card);
      });
    });
  });
}

// =======================
// HISTORY (READ ONLY)
// =======================
function renderHistory() {
  onValue(ref(db, 'alerts_history'), snap => {
    historyTable.innerHTML = '';
    const data = snap.val() || {};

    // Perbaiki loop: Struktur adalah alerts_history/room/pushKey/alertObject
    Object.entries(data).forEach(([room, roomData]) => {
      Object.entries(roomData || {}).forEach(([key, ev]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${room.replace('room_', '')}</td>
          <td>${ev.type}</td>
          <td>${ev.status}</td>
          <td>${new Date(ev.handledAt || ev.createdAt).toLocaleString()}</td>
        `;
        historyTable.appendChild(tr);
      });
    });
  });
}

// =======================
// TAB SWITCHING
// =======================
document.getElementById('tab-dashboard').onclick = () => {
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('history').style.display = 'none';
};
document.getElementById('tab-history').onclick = () => {
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('history').style.display = 'block';
};

// =======================
// CLEAR HANDLED ALERTS (Menggunakan Modal Kustom)
// =======================
document.getElementById('clear-handled-btn').onclick = async () => {
  const message = "Apakah Anda yakin ingin membersihkan semua alerts yang sudah ditangani? Ini akan menghapusnya dari tampilan aktif.";
  
  showConfirmModal(message, async () => {
    try {
      const snapshot = await get(ref(db, 'alerts_active'));
      const data = snapshot.val() || {};

      const promises = [];
      Object.entries(data).forEach(([room, alerts]) => {
        Object.entries(alerts || {}).forEach(([key, alert]) => {
          if (alert.status === 'Ditangani') {
            promises.push(remove(ref(db, `alerts_active/${room}/${key}`)));
          }
        });
      });
      await Promise.all(promises);

      alert("Alerts ditangani berhasil dibersihkan!"); // Bisa diganti dengan toast notification di masa depan
    } catch (error) {
      console.error("Error clearing handled alerts:", error);
      alert("Gagal membersihkan alerts. Coba lagi.");
    }
  });
};

// =======================
// FILTER HISTORY (Force fallback manual jika query gagal)
// =======================
document.getElementById('filter-btn').onclick = async () => {
  const filterDate = document.getElementById('filter-date').value;
  if (!filterDate) {
    alert("Pilih tanggal untuk filter!");
    return;
  }

  try {
    const selectedDate = new Date(filterDate);
    if (isNaN(selectedDate.getTime())) {
      alert("Tanggal tidak valid!");
      return;
    }
    const startOfDay = selectedDate.setHours(0, 0, 0, 0);
    const endOfDay = selectedDate.setHours(23, 59, 59, 999);

    console.log("Filter: Input date:", filterDate, "Start ms:", startOfDay, "End ms:", endOfDay);

    // Force fallback: Selalu ambil semua history, filter manual di client
    const snapshot = await get(ref(db, 'alerts_history'));
    const data = snapshot.val() || {};
    console.log("All history data:", data);

    historyTable.innerHTML = '';
    let hasData = false;
    Object.entries(data).forEach(([room, roomData]) => {
      Object.entries(roomData || {}).forEach(([key, ev]) => {
        const eventTime = ev.handledAt || ev.createdAt;
        console.log("Checking event - HandledAt:", eventTime, "Type:", ev.type, "Readable:", new Date(eventTime).toLocaleString());
        
        if (typeof eventTime === 'number' && eventTime >= startOfDay && eventTime <= endOfDay) {
          hasData = true;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${room.replace('room_', '')}</td>
            <td>${ev.type}</td>
            <td>${ev.status}</td>
            <td>${new Date(eventTime).toLocaleString()}</td>
          `;
          historyTable.appendChild(tr);
        }
      });
    });

    if (!hasData) {
      alert("Tidak ada history pada tanggal tersebut. Pastikan data memiliki field 'handledAt' yang valid (number ms).");
    }
  } catch (error) {
    console.error("Error filtering history:", error);
    alert(`Gagal memfilter history: ${error.message}.`);
  }
};

// =======================
// HAPUS HISTORY (Menggunakan Modal Kustom)
// =======================
document.getElementById('delete-history-btn').onclick = async () => {
  const deleteDate = document.getElementById('delete-date').value;
  if (!deleteDate) {
    alert("Pilih tanggal untuk hapus!");
    return;
  }

  const message = `Apakah Anda yakin ingin menghapus semua history pada tanggal ${deleteDate}? Tindakan ini tidak bisa dibatalkan!`;

  showConfirmModal(message, async () => {
    try {
      const selectedDate = new Date(deleteDate);
      if (isNaN(selectedDate.getTime())) {
        alert("Tanggal tidak valid!");
        return;
      }
      const startOfDay = selectedDate.setHours(0, 0, 0, 0);
      const endOfDay = selectedDate.setHours(23, 59, 59, 999);

      console.log("Delete: Input date:", deleteDate, "Start ms:", startOfDay, "End ms:", endOfDay);

      // Force fallback: Ambil semua, filter manual
      const snapshot = await get(ref(db, 'alerts_history'));
      const data = snapshot.val();
      console.log("All history data for delete:", data);

      if (!data) {
        alert("Tidak ada history sama sekali.");
        return;
      }

      const promises = [];
      Object.entries(data).forEach(([room, roomData]) => {
        Object.entries(roomData || {}).forEach(([key, ev]) => {
          const eventTime = ev.handledAt || ev.createdAt;
          console.log("Delete check - Event time:", eventTime);
          if (typeof eventTime === 'number' && eventTime >= startOfDay && eventTime <= endOfDay) {
            promises.push(remove(ref(db, `alerts_history/${room}/${key}`)));
          }
        });
      });

      if (promises.length === 0) {
        alert("Tidak ada history yang cocok untuk dihapus.");
        return;
      }

      await Promise.all(promises);
      alert("History berhasil dihapus!"); // Bisa diganti dengan toast notification di masa depan
      renderHistory();
    } catch (error) {
      console.error("Error deleting history:", error);
      alert(`Gagal menghapus history: ${error.message}.`);
    }
  });
};

// =======================
// LOGOUT
// =======================
document.getElementById('logout-btn').onclick = async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Error logging out:", error);
    alert("Gagal logout. Coba lagi.");
  }
};

// =======================
// AUTH
// =======================
onAuthStateChanged(auth, user => {
  if (!user) return window.location.href = "index.html";
  listenAlerts();
  renderHistory();
});
