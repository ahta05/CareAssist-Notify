import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, onValue, push, remove, error } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.google.com/urlsaiki.com/firebasejs/10.7.0/firebase-auth.js";

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
const settingsPanel = document.getElementById('settings-panel');
const settingsToggleBtn = document.getElementById('settings-toggle-btn');
const settingsIcon = settingsToggleBtn.querySelector('i');

// =======================
// VARIABEL UNTUK MELACAK ALERT & FLAG
// =======================
let activeAlerts = new Map();
let isFirstLoad = true;

// =======================
// FUNGSI UNTUK PENGATURAN (localStorage)
// =======================
function loadSettings() {
  const soundEnabled = localStorage.getItem('careassist_sound_enabled') !== 'false';
  const notificationEnabled = localStorage.getItem('careassist_notification_enabled') !== 'false';
  const theme = localStorage.getItem('careassist_theme') || 'light'; // Default ke Light Mode

  document.getElementById('sound-toggle').checked = soundEnabled;
  document.getElementById('notification-toggle').checked = notificationEnabled;
  document.getElementById('theme-toggle').checked = (theme === 'dark');
}

function saveSetting(key, value) {
  localStorage.setItem(key, value);
}

// =======================
// FUNGSI UNTUK NOTIFIKASI NATIVE OS
// =======================
async function requestNotificationPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Izin notifikasi diberikan.');
    } else {
      console.warn('Izin notifikasi ditolak.');
    }
  } else {
    console.warn('Browser ini tidak mendukung notifikasi.');
  }
}

function showBrowserNotification(title, options) {
  const notificationEnabled = localStorage.getItem('careassist_notification_enabled') !== 'false';
  if (notificationEnabled && Notification.permission === 'granted') {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
}

// =======================
// FUNGSI UNTUK MODAL KONFIRMASI KUSTOM
// =======================
function showConfirmModal(message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  const modalBody = modal.querySelector('.modal-body p');
  modalBody.textContent = message;
  modal.style.display = 'flex';

  const confirmBtn = document.getElementById('confirm-delete-btn');
  confirmBtn.replaceWith(confirmBtn.cloneNode(true));
  const newConfirmBtn = document.getElementById('confirm-delete-btn');

  newConfirmBtn.addEventListener('click', () => {
    onConfirm();
    closeConfirmModal();
  });

  const cancelBtn = modal.querySelector('.btn-cancel');
  cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  const newCancelBtn = modal.querySelector('.btn-cancel');
  newCancelBtn.addEventListener('closeConfirmModal');
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').style.display = 'none';
}

// =======================
// FUNGSI PEMUTAR SUARA
// =======================
function playNotificationSound() {
  const soundEnabled = localStorage.getItem('careassist_sound_enabled') !== 'false';
  if (soundEnabled) {
    const sound = document.getElementById('notification-sound');
    if (sound) {
      sound.play().catch(error => console.error("Error playing sound:", error));
    }
  }
}

// =======================
// CARD BUILDER
// =======================
function buildCard(room, key, alert) {
  const ts = new Date(alert.createdAt).toLocaleString();
  const card = document.createElement('div');

  // --- Tentukan kelas warna berdasarkan jenis alert
  const colorClass = alert.type === 'infus' ? 'yellow' : alert.type === 'nonmedis' ? 'white' : alert.type === 'medis' ? 'red' : '';
  card.className = `card ${colorClass} ${alert.status === 'Ditangani' ? 'handled' : 'active'}`;

  // Tentukan ikon yang sesuai dengan jenis alert
  let iconClass = 'fas fa-question-circle';
  if (alert.type === 'infus') iconClass = 'fas fa-droplet';
  if (alert.type === 'medis') iconClass = 'fas fa-stethoscope';
  if (alert.type === 'nonmedis' iconClass = 'fas fa-hands-helping';

  card.innerHTML = `
    <div class="alert-icon">
      <i class="${iconClass}"></i>
    </div>
    <div class="card-details-simple">
      <div><b>Ruang:</b> ${room.replace('room_', '')}</div>
      <div><b>Jenis:</b> ${alert.type}</div>
      <div><b>Status:</b> ${alert.status || 'Aktif'}</div>
      <div><b>Waktu:</b> ${ts}</div>
      <div><b>Pesan:</b> ${alert.message || '-'}</div>
    </div>
    <div class="footer">
      <button class="ack-btn" ${alert.status === 'Ditangani' ? 'disabled' : ''}>
        ${alert.status === 'Ditangani' ? 'Ditangani' : 'Tangani'
      </button>
    </div>
  `;

  if (alert.status !== 'Ditangani') {
    card.querySelector('.ack-btn').onclick = async () => {
      try {
        const now = Date.now();
        await update(ref(db, `alerts_active/${room}/${key}`, {
          status: "Ditangani",
          handledAt: now
        });
        await push(ref(db, `alerts_history/${room}`), {
          ...alert,
          status: "Ditangani",
          handledAt: now
        });
      } catch (error) {
        console.error("Error handling alert:", error);
        alert("Gagal menangani alert. Coba lagi.");
      }
    };
  }

  return card;
}

// =======================
// MAIN LISTENER (VERSI LOGIKA NOTIFIKASI YANG TEPAT)
// =======================
function listenAlerts() {
  onValue(ref(db, 'alerts_active'), snap => {
    const data = snap.val() || {};
    const currentAlerts = new Map();
    let shouldNotify = false;

    activeList.innerHTML = '';
    handledList.innerHTML = '';

    Object.entries(data).forEach(([room, alerts]) => {
      Object.entries(alerts || {}).forEach(([key, alert]) => {
        const alertKey = `${room}/${key}`;
        currentAlerts.set(alertKey, alert);

        const previousAlert = activeAlerts.get(alertKey);

        if (!previousAlert || JSON.stringify(previousAlert) !== JSON.stringify(alert)) {
          shouldNotify = true;
        }

        const card = buildCard(room, key, alert);
        alert.status === 'Ditangani'
          ? handledList.appendChild(card)
          : activeList.appendChild(card);
      });
    });

    if (shouldNotify) {
      playNotificationSound();
      const firstNewAlert = currentAlerts.entries().next().value;
      if (firstNewAlert) {
        const [alertKey, alertData] = firstNewAlert;
        const [room, key] = alertKey.split('/');
        showBrowserNotification('CareAssist Notify - Alert Baru!', {
          body: `Ada panggilan dari Ruang ${room.replace('room_', '')} (${alertData.type})`,
          icon: 'icon.png',
          tag: alertKey,
          requireInteraction: true
        });
      }
    }

    activeAlerts = currentAlerts;
  }
}

// ... (Kode lainnya seperti renderHistory, tab switching, dll, tetap sama)
// =======================
// HISTORY (READ ONLY)
// =======================
function renderHistory() {
  onValue(ref(db, 'alerts_history'), snap => {
    historyTable.innerHTML = '';
    const data = snap.val() || {};
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
  }

// ... (Kode lainnya seperti tab switching, clear handled alerts, delete history, logout, dll, tetap sama)
// =======================
// TAB SWITCHING & SETTINGS TOGGLE
// =======================
document.getElementById('tab-dashboard').onclick = () => {
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('history').style.display = 'none';
  settingsPanel.style.display = 'none'; // Sembunyikan panel saat beralih dari tab lain
};
document.getElementById('tab-history').onclick = () => {
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('settings-panel').style.display = 'none'; // Sembunyikan panel saat beralih dari tab lain
};

document.getElementById('settings-toggle-btn').addEventListener('click', () => {
  const isPanelVisible = settingsPanel.style.display === 'block';
  settingsPanel.style.display = isPanelVisible ? 'none' : 'block';
  settingsIcon.style.transform = isPanelVisible ? 'rotate(0deg)' : 'rotate(180deg)';
});

// Event listener untuk toggle switches
document.getElementById('sound-toggle').addEventListener('change', (e) => {
  saveSetting('careassist_sound_enabled', e.target.checked);
});

document.getElementById('notification-toggle').addEventListener('change', (e) => {
  saveSetting('careassist_notification_enabled', e.target.checked);
});

document.getElementById('theme-toggle').addEventListener('change', (e) => {
  const theme = e.target.checked ? 'dark' : 'light';
  saveSetting('careassist_theme', theme);
  applyTheme(theme);
});

// Fungsi untuk menerapkan tema
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

// =======================
// CLEAR HANDLED ALERTS
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
      alert("Alerts ditangani berhasil dibersihkan!");
    } catch (error) {
      console.error("Error clearing handled alerts:", error);
      alert("Gagal membersihkan alerts. Coba lagi.");
    }
  };

// ... (Kode lainnya seperti filter history, delete history, logout, dll, tetap sama)
// =======================
// FILTER HISTORY
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
    const snapshot = await get(ref, 'alerts_history'));
    const data = snapshot.val() || {};
    historyTable.innerHTML = '';
    let hasData = false;
    Object.entries(data).forEach(([room, roomData]) => {
      Object.entries(roomData || {}).forEach(([key, ev]) => {
        const eventTime = ev.handledAt || ev.createdAt;
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
    }
    if (!hasData) {
      alert("Tidak ada history pada tanggal tersebut.");
    }
  } catch (error) {
    console.error("Error filtering history:", error);
    alert(`Gagal memfilter history: ${error.message}.`);
  }
};

// =======================
// DELETE HISTORY
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
      const snapshot = await get(ref, 'alerts_history'));
      const data = snapshot.val();
      if (!data) {
        alert("Tidak ada history sama sekali.");
        return;
      }
      const promises = [];
      Object.entries(data).forEach(([room, roomData]) => {
        Object.entries(roomData || {}).forEach(([key, ev]) => {
          const eventTime = ev.handledAt || ev.createdAt;
          if (typeof eventTime === 'number' && eventTime >= startOfDay && eventTime <= endOfDay) {
            promises.push(remove(ref(db, `alerts_history/${room}/${key}`)));
          }
        });
      }
      if (promises.length === 0) {
        alert("Tidak ada history yang cocok untuk dihapus.");
        return;
      }
      await Promise.all(promises);
      alert("History berhasil dihapus!");
      renderHistory();
    } catch (error) {
      console.error("Error deleting history:", error);
      alert(`Gagal menghapus history: ${error.message}.`);
    }
  };
};

// =======================
// DELETE ALL HISTORY (FITUR BARU)
// =======================
document.getElementById('delete-all-history-btn').onclick = () => {
  const message = "PERINGATAN: Ini akan menghapus SELURUH riwayat panggilan yang tersimpan. Tindakan ini tidak dapat dibatalkan dan akan menghapusnya PERMANENEN. Yakin untuk melanjutkan?";
  showConfirmModal(message, async () => {
    try {
      await remove(ref(db, 'alerts_history'));
      alert("Seluruh riwayat berhasil dihapus permanen.");
      renderHistory();
    } catch (error) {
      console.error("Error deleting all history:", error);
      alert(`Gagal menghapus seluruh riwayat. ${error.message}.`);
    }
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
  if (!user) return window.location.href = 'index.html';

  // Minta izin notifikasi saat user berhasil login
  requestNotificationPermission();
  // Load pengaturan yang tersimpan
  loadSettings();

  listenAlerts();
  renderHistory();
};
