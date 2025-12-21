import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, onValue, push, remove, update, get } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// Firebase config
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

// DOM Elements
const activeList = document.getElementById('active-list');
const handledList = document.getElementById('handled-list');
const historyTable = document.getElementById('history-table');
const settingsToggleBtn = document.getElementById('settings-toggle-btn');
const dropdownContent = document.querySelector('.dropdown-content');

// =======================
// VARIABEL UNTUK MELACAK ALERT & FLAG
// =======================
let activeAlerts = new Map();
let isFirstLoad = true;

// =======================
// FUNGSI PENGATURAN (localStorage)
// =======================
function loadSettings() {
  const soundEnabled = localStorage.getItem('careassist_sound_enabled') !== 'false';
  const notificationEnabled = localStorage.getItem('careassist_notification_enabled') !== 'false';
  const theme = localStorage.getItem('careassist_theme') || 'light';

  document.getElementById('sound-toggle').checked = soundEnabled;
  document.getElementById('notification-toggle').checked = notificationEnabled;
  document.getElementById('theme-select').value = theme;
  applyTheme(theme);
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
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  newConfirmBtn.addEventListener('click', () => { onConfirm(); closeConfirmModal(); });

  const cancelBtn = modal.querySelector('.btn-cancel');
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
  newCancelBtn.addEventListener('click', closeConfirmModal);
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').style.display = 'none';
}

// =======================
// FUNGSI UNTUK TEMA (LIGHT/DARK)
// =======================
function applyTheme(theme) {
  const logo = document.getElementById('main-logo');

  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    logo.src = 'logo-dark.png'; // TAMBAHKAN BARIS INI
  } else {
    document.body.classList.remove('dark-mode');
    logo.src = 'logo-light.png'; // TAMBAHKAN BARIS INI
  }
}

// =======================
// FUNGSI PEMUTAR SUARA
// =======================
function playNotificationSound() {
  const sound = document.getElementById('notification-sound');
  if (sound) {
    sound.play().catch(error => console.error("Error playing sound:", error));
  }
}

// =======================
// CARD BUILDER (STRUKTUR HTML DIPERBAIKI)
// =======================
function buildCard(room, key, alert) {
  const ts = new Date(alert.createdAt).toLocaleString();
  const card = document.createElement('div');
  const colorClass = alert.type === 'infus' ? 'yellow' : alert.type === 'nonmedis' ? 'white' : alert.type === 'medis' ? 'red' : '';
  card.className = `card ${colorClass} ${alert.status === 'Ditangani' ? 'handled' : 'active'}`;

  let iconClass = 'fas fa-question-circle';
  switch (alert.type) {
    case 'infus': iconClass = 'fas fa-droplet'; break;
    case 'medis': iconClass = 'fas fa-stethoscope'; break;
    case 'nonmedis': iconClass = 'fas fa-hands-helping'; break;
  }

  // PERBAIKAN: Struktur HTML disesuaikan dengan CSS Flexbox yang baru
  card.innerHTML = `
    <div class="alert-icon"><i class="${iconClass}"></i></div>
    <div class="card-details-container">
      <div class="card-details-simple">
        <div><b>Ruang:</b> ${room.replace('room_', '')}</div>
        <div><b>Jenis:</b> ${alert.type}</div>
      </div>
      <div class="card-details-simple">
        <div><b>Status:</b> ${alert.status || 'Aktif'}</div>
        <div><b>Waktu:</b> ${ts}</div>
      </div>
      <div class="card-details-simple">
        <div><b>Pesan:</b> ${alert.message || '-'}</div>
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
        await update(ref(db, `alerts_active/${room}/${key}`), { status: "Ditangani", handledAt: now });
        await push(ref(db, `alerts_history/${room}`), { ...alert, status: "Ditangani", handledAt: now });
      } catch (error) {
        console.error("Error handling alert:", error);
        alert("Gagal menangani alert. Coba lagi.");
      }
    };
  }
  return card;
}

// =======================
// MAIN LISTENER (LOGIKA NOTIFIKASI SUDAH BENAR)
// =======================
function listenAlerts() {
  onValue(ref(db, 'alerts_active'), snap => {
    const data = snap.val() || {};
    const currentAlerts = new Map();
    let shouldNotify = false;
    activeList.innerHTML = '';
    handledList.innerHTML = '';
    let hasActiveAlerts = false, hasHandledAlerts = false;

    Object.entries(data).forEach(([room, alerts]) => {
      Object.entries(alerts || {}).forEach(([key, alert]) => {
        const alertKey = `${room}/${key}`;
        currentAlerts.set(alertKey, alert);
        const previousAlert = activeAlerts.get(alertKey);

        // LOGIKA NOTIFIKASI YANG BENAR: HANYA UNTUK ALERT BARU ATAU DIPERBARUI YANG MASIH AKTIF
        if (alert.status !== 'Ditangani') {
          if (!previousAlert || previousAlert.createdAt !== alert.createdAt) {
            shouldNotify = true;
          }
        }

        const card = buildCard(room, key, alert);
        if (alert.status === 'Ditangani') {
          handledList.appendChild(card);
          hasHandledAlerts = true;
        } else {
          activeList.appendChild(card);
          hasActiveAlerts = true;
        }
      });
    });

    if (!hasActiveAlerts) activeList.innerHTML = `<p class="empty-state"><i class="fas fa-check-circle"></i> Tidak ada panggilan aktif saat ini.</p>`;
    if (!hasHandledAlerts) handledList.innerHTML = `<p class="empty-state"><i class="fas fa-clipboard-check"></i> Belum ada panggilan yang selesai.</p>`;

    if (shouldNotify && !isFirstLoad) {
      playNotificationSound();
      const newAlertEntry = [...currentAlerts.entries()].find(([key, alert]) => {
          const prev = activeAlerts.get(key);
          return (!prev || prev.createdAt !== alert.createdAt) && alert.status !== 'Ditangani';
      });
      if (newAlertEntry) {
        const [alertKey, alertData] = newAlertEntry;
        const [room] = alertKey.split('/');
        showBrowserNotification('CareAssist Notify - Alert Baru!', {
          body: `Ada panggilan dari Ruang ${room.replace('room_', '')} (${alertData.type})`,
          icon: 'icon.png', tag: alertKey, requireInteraction: true
        });
      }
    }
    activeAlerts = currentAlerts;
    isFirstLoad = false;
  });
}

// =======================
// HISTORY (READ ONLY)
// =======================
function renderHistory() {
  onValue(ref(db, 'alerts_history'), snap => {
    historyTable.innerHTML = '';
    const data = snap.val() || {};
    let hasHistoryData = false;
    Object.entries(data).forEach(([room, roomData]) => {
      Object.entries(roomData || {}).forEach(([key, ev]) => {
        hasHistoryData = true;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${room.replace('room_', '')}</td><td>${ev.type}</td><td>${ev.status}</td><td>${new Date(ev.handledAt || ev.createdAt).toLocaleString()}</td>`;
        historyTable.appendChild(tr);
      });
    });
    if (!hasHistoryData) {
      historyTable.innerHTML = `<tr><td colspan="4" class="empty-state">Belum ada riwayat panggilan.</td></tr>`;
    }
  });
}

// =======================
// TAB SWITCHING
// =======================
function initializeTabs() {
  const dashboardTab = document.getElementById('tab-dashboard');
  const historyTab = document.getElementById('tab-history');
  const dashboardSection = document.getElementById('dashboard');
  const historySection = document.getElementById('history');
  dashboardTab.classList.add('active');
  dashboardSection.style.display = 'block';
  historySection.style.display = 'none';
  dashboardTab.onclick = () => {
    dashboardTab.classList.add('active'); historyTab.classList.remove('active');
    dashboardSection.style.display = 'block'; historySection.style.display = 'none';
    dropdownContent.classList.remove('show');
  };
  historyTab.onclick = () => {
    historyTab.classList.add('active'); dashboardTab.classList.remove('active');
    dashboardSection.style.display = 'none'; historySection.style.display = 'block';
    dropdownContent.classList.remove('show');
  };
}

// =======================
// EVENT LISTENERS
// =======================
settingsToggleBtn.addEventListener('click', (event) => {
  event.stopPropagation(); dropdownContent.classList.toggle('show');
});
document.addEventListener('click', (event) => {
  if (!settingsToggleBtn.contains(event.target) && !dropdownContent.contains(event.target)) {
    dropdownContent.classList.remove('show');
  }
});
document.getElementById('sound-toggle').addEventListener('change', (e) => { saveSetting('careassist_sound_enabled', e.target.checked); });
document.getElementById('notification-toggle').addEventListener('change', (e) => { saveSetting('careassist_notification_enabled', e.target.checked); });
document.getElementById('theme-select').addEventListener('change', (e) => {
  const theme = e.target.value; saveSetting('careassist_theme', theme); applyTheme(theme);
});

// --- Clear Handled Alerts ---
document.getElementById('clear-handled-btn').onclick = () => {
  const message = "Apakah Anda yakin ingin membersihkan semua alerts yang sudah ditangani?";
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
    } catch (error) { console.error("Error clearing handled alerts:", error); alert("Gagal membersihkan alerts. Coba lagi."); }
  });
};

// --- Filter History ---
document.getElementById('filter-btn').onclick = async () => {
  const filterDate = document.getElementById('filter-date').value;
  if (!filterDate) { historyTable.innerHTML = `<tr><td colspan="4" class="empty-state">Silakan pilih tanggal terlebih dahulu.</td></tr>`; return; }
  try {
    const selectedDate = new Date(filterDate);
    if (isNaN(selectedDate.getTime())) { historyTable.innerHTML = `<tr><td colspan="4" class="empty-state">Tanggal tidak valid.</td></tr>`; return; }
    const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999)).getTime();
    const snapshot = await get(ref(db, 'alerts_history'));
    const data = snapshot.val() || {}; historyTable.innerHTML = ''; let hasData = false;
    Object.entries(data).forEach(([room, roomData]) => {
      Object.entries(roomData || {}).forEach(([key, ev]) => {
        const eventTime = ev.handledAt || ev.createdAt;
        if (typeof eventTime === 'number' && eventTime >= startOfDay && eventTime <= endOfDay) {
          hasData = true; const tr = document.createElement('tr');
          tr.innerHTML = `<td>${room.replace('room_', '')}</td><td>${ev.type}</td><td>${ev.status}</td><td>${new Date(eventTime).toLocaleString()}</td>`;
          historyTable.appendChild(tr);
        }
      });
    });
    if (!hasData) { historyTable.innerHTML = `<tr><td colspan="4" class="empty-state">Tidak ada riwayat pada tanggal ${new Date(filterDate).toLocaleDateString('id-ID')}.</td></tr>`; }
  } catch (error) { console.error("Error filtering history:", error); historyTable.innerHTML = `<tr><td colspan="4" class="empty-state">Gagal memfilter history: ${error.message}.</td></tr>`; }
};

// --- Delete History by Date ---
document.getElementById('delete-history-btn').onclick = async () => {
  const deleteDate = document.getElementById('delete-date').value;
  if (!deleteDate) { alert("Silakan pilih tanggal yang ingin dihapus riwayatnya."); return; }
  const selectedDate = new Date(deleteDate);
  const formattedDate = selectedDate.toLocaleDateString('id-ID');
  const message = `Apakah Anda yakin ingin menghapus SEMUA riwayat panggilan pada tanggal ${formattedDate}? Tindakan ini tidak dapat dibatalkan.`;
  showConfirmModal(message, async () => {
    try {
      const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0)).getTime();
      const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999)).getTime();
      const snapshot = await get(ref(db, 'alerts_history'));
      const data = snapshot.val() || {}; const promises = [];
      Object.entries(data).forEach(([room, roomData]) => {
        Object.entries(roomData || {}).forEach(([key, ev]) => {
          const eventTime = ev.handledAt || ev.createdAt;
          if (typeof eventTime === 'number' && eventTime >= startOfDay && eventTime <= endOfDay) {
            promises.push(remove(ref(db, `alerts_history/${room}/${key}`)));
          }
        });
      });
      if (promises.length === 0) { alert(`Tidak ada riwayat pada tanggal ${formattedDate} untuk dihapus.`); return; }
      await Promise.all(promises);
      alert(`Berhasil menghapus ${promises.length} riwayat pada tanggal ${formattedDate}.`);
      document.getElementById('delete-date').value = '';
    } catch (error) { console.error("Error deleting history:", error); alert(`Gagal menghapus riwayat: ${error.message}.`); }
  });
};

// --- Logout ---
document.getElementById('logout-btn').onclick = async () => {
  try { await signOut(auth); window.location.href = "index.html"; }
  catch (error) { console.error("Error logging out:", error); alert("Gagal logout. Coba lagi."); }
};

// =======================
// AUTH INITIALIZATION
// =======================
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = "index.html"; return; }
  requestNotificationPermission(); loadSettings(); initializeTabs(); listenAlerts(); renderHistory();
});
