#include <ESP8266WiFi.h>
#include <FirebaseESP8266.h>
#include <time.h>

#include <WiFiManager.h> 

#define FIREBASE_API_KEY "AIzaSyBqTDry_kn-PJVwfc8Fi9BG457hhI2ObPA"
#define FIREBASE_DATABASE_URL "https://nurse-alert-001-default-rtdb.asia-southeast1.firebasedatabase.app"

#define USER_EMAIL "nursealerts@gmail.com"
#define USER_PASSWORD "nursealerts001"

#define ROOM_ID "001"
#define ALERT_TIMEOUT_MS 20000 // 20 detik

#define NTP_SERVER "pool.ntp.org"
#define GMT_OFFSET_SEC 25200
#define DAYLIGHT_OFFSET_SEC 0

// --- PERBAIKAN: Tambahkan lastDebounceTime ke dalam struct ---
struct AlertButton {
  const uint8_t buttonPin;
  const uint8_t ledPin;
  const char* alertType;
  const char* alertMessage;
  
  bool isActive;
  unsigned long alertStartTime;
  String alertPushId;
  int lastButtonState;
  unsigned long lastDebounceTime; // <-- TAMBAHKAN INI
};

// --- PERBAIKAN: Inisialisasi lastDebounceTime dengan 0 untuk setiap tombol ---
AlertButton buttons[3] = {
  {D1, D5, "infus", "Infus pasien hampir habis, segera periksa kondisi infus.", false, 0, "", HIGH, 0},
  {D2, D6, "medis", "Pasien merasakan keluhan medis, segera beri penanganan.", false, 0, "", HIGH, 0},
  {D3, D7, "nonmedis", "Pasien memerlukan bantuan non-medis, segera datangi ruangan.", false, 0, "", HIGH, 0}
};

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

WiFiManager wm;

bool signupOK = false;
// --- PERBAIKAN: Hapus variabel global ini karena sudah ada di struct ---
// unsigned long lastDebounceTime = 0; 
const unsigned long debounceDelay = 200;
unsigned long sendDataPrevMillis = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("\n--- Nurse Alert System Starting ---");

  for (int i = 0; i < 3; i++) {
    pinMode(buttons[i].buttonPin, INPUT_PULLUP);
    pinMode(buttons[i].ledPin, OUTPUT);
    digitalWrite(buttons[i].ledPin, LOW);
  }
  Serial.println("Pin initialization complete.");

  setupWiFiManager();
  setupTime();
  setupFirebase();
  
  Serial.println("--- System Ready. Waiting for button press. ---");
}

void loop() {
  wm.process();

  for (int i = 0; i < 3; i++) {
    checkButton(i);
  }

  // --- GANTI BAGIAN INI ---
  // 2. Cek timeout untuk setiap alert yang aktif
  for (int i = 0; i < 3; i++) {
    if (buttons[i].isActive && (millis() - buttons[i].alertStartTime > ALERT_TIMEOUT_MS)) {
      Serial.printf("Alert %s timeout setelah %d detik. Mematikan LED.\n", buttons[i].alertType, ALERT_TIMEOUT_MS / 1000);
      digitalWrite(buttons[i].ledPin, LOW);
      // PERBAIKAN: JANGAN reset state di sini. Biarkan checkHandledStatus() yang menanganinya.
      // buttons[i].isActive = false; // HAPUS BARIS INI
      // buttons[i].alertPushId = ""; // HAPUS BARIS INI
    }
  }

  if (millis() - sendDataPrevMillis > 3000 || sendDataPrevMillis == 0) {
    sendDataPrevMillis = millis();
    checkHandledStatus();
  }
}

void setupWiFiManager() {
  String portalName = "NurseAlert-Setup-" + String(ROOM_ID);
  wm.setConfigPortalTimeout(300);
  if (!wm.autoConnect(portalName.c_str())) {
    Serial.println("Gagal terhubung ke WiFi dan timeout portal.");
    Serial.println("Memulai ulang perangkat...");
    ESP.restart();
  } 
  Serial.println("\nBerhasil terhubung ke WiFi!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

// --- FUNGSI DEBUG INI SEKARANG AKAN BEKERJA DENGAN BENAR ---
void checkButton(int index) {
  int reading = digitalRead(buttons[index].buttonPin);

  if (reading != buttons[index].lastButtonState) {
    // --- DEBUG: Cetak status saat tombol ditekan ---
    Serial.printf(">>> TOMBOL %s DITEKAN <<<\n", buttons[index].alertType);
    Serial.printf("DEBUG: Status 'isActive' saat ini: %s\n", buttons[index].isActive ? "TRUE" : "FALSE");
    Serial.printf("DEBUG: 'alertPushId' saat ini: '%s'\n", buttons[index].alertPushId.c_str());
    Serial.println("------------------------------------");

    buttons[index].lastDebounceTime = millis();
  }

  if ((millis() - buttons[index].lastDebounceTime) > debounceDelay) {
    if (reading == LOW) {
      if (!buttons[index].isActive) {
        Serial.printf("LOGIKA: isActive adalah FALSE. Mengirim alert BARU...\n");
        buttons[index].isActive = true;
        buttons[index].alertStartTime = millis();
        sendNurseAlert(index);
      } else {
        Serial.printf("LOGIKA: isActive adalah TRUE. Memperbarui alert yang ada...\n");
        updateNurseAlert(index);
      }
    }
  }
  buttons[index].lastButtonState = reading;
}

void sendNurseAlert(int index) {
  Serial.printf("Mengirim alert %s ke Firebase...\n", buttons[index].alertType);
  digitalWrite(buttons[index].ledPin, HIGH);
  if (Firebase.ready() && signupOK) {
    String path = "/alerts_active/room_" + String(ROOM_ID);
    FirebaseJson json;
    json.set("type", buttons[index].alertType);
    json.set("status", "Aktif");
    json.set("message", buttons[index].alertMessage);
    time_t now = time(nullptr);
    json.set("createdAt", (long long)now * 1000);
    if (Firebase.pushJSON(fbdo, path.c_str(), json)) {
      buttons[index].alertPushId = fbdo.pushName();
      Serial.printf(">>> BERHASIL! Alert dikirim dengan ID: %s\n", buttons[index].alertPushId.c_str());
    } else {
      Serial.println(">>> GAGAL MENGIRIM!");
      Serial.printf("Reason: %s\n", fbdo.errorReason().c_str());
      digitalWrite(buttons[index].ledPin, LOW);
      buttons[index].isActive = false;
    }
  } else {
    Serial.println(">>> GAGAL! Firebase belum siap atau belum terautentikasi.");
    digitalWrite(buttons[index].ledPin, LOW);
    buttons[index].isActive = false;
  }
}

void updateNurseAlert(int index) {
  if (Firebase.ready() && signupOK && buttons[index].alertPushId != "") {
    String path = "/alerts_active/room_" + String(ROOM_ID) + "/" + buttons[index].alertPushId;
    Serial.printf("Memperbarui alert di path: %s\n", path.c_str());

    FirebaseJson json;
    // Kirim SEMUA data lagi
    json.set("type", buttons[index].alertType);
    json.set("status", "Aktif");
    json.set("message", buttons[index].alertMessage);
    time_t now = time(nullptr);
    json.set("createdAt", (long long)now * 1000);

    if (Firebase.updateNode(fbdo, path.c_str(), json)) {
      Serial.printf(">>> BERHASIL! Alert %s diperbarui.\n", buttons[index].alertType);
      // PERBAIKAN: Nyalakan LED lagi karena tombol ditekan ulang
      digitalWrite(buttons[index].ledPin, HIGH);
      // Reset timer lokal agar LED tidak mati lagi
      buttons[index].alertStartTime = millis();
    } else {
      Serial.println(">>> GAGAL MEMPERBARUI!");
      Serial.printf("Reason: %s\n", fbdo.errorReason().c_str());
    }
  } else {
     Serial.println(">>> GAGAL MEMPERBARUI! Firebase belum siap atau tidak ada ID alert untuk diperbarui.");
  }
}

void checkHandledStatus() {
  if (!Firebase.ready() || !signupOK) return;
  for (int i = 0; i < 3; i++) {
    if (buttons[i].isActive && buttons[i].alertPushId != "") {
      String path = "/alerts_active/room_" + String(ROOM_ID) + "/" + buttons[i].alertPushId;
      if (Firebase.getJSON(fbdo, path.c_str())) {
        FirebaseJson json = fbdo.jsonObject();
        FirebaseJsonData jsonData;
        if (json.get(jsonData, "status")) {
          if (jsonData.stringValue == "Ditangani") {
            Serial.printf("Alert %s (ID: %s) sudah ditangani. Mematikan LED.\n", buttons[i].alertType, buttons[i].alertPushId.c_str());
            digitalWrite(buttons[i].ledPin, LOW);
            buttons[i].isActive = false;
            buttons[i].alertPushId = "";
          }
        }
      } else {
        if (fbdo.httpCode() == FIREBASE_ERROR_HTTP_CODE_NOT_FOUND) {
           Serial.printf("Alert %s (ID: %s) tidak ditemukan. Mematikan LED.\n", buttons[i].alertType, buttons[i].alertPushId.c_str());
           digitalWrite(buttons[i].ledPin, LOW);
           buttons[i].isActive = false;
           buttons[i].alertPushId = "";
        }
      }
    }
  }
}

void setupTime() {
  Serial.println("Mengatur waktu dari NTP Server...");
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  while (time(nullptr) < 8 * 3600 * 2) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWaktu berhasil disinkronkan!");
  time_t now = time(nullptr);
  Serial.printf("Waktu saat ini: %s", ctime(&now));
}

void setupFirebase() {
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Serial.print("Menghubungkan ke Firebase...");
  while (Firebase.ready() == false) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  Serial.println("Terhubung dan terautentikasi dengan Firebase!");
  signupOK = true; 
}