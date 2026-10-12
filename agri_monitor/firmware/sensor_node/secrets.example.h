// Copy this file to secrets.h and fill in your values.
// secrets.h is git-ignored so your Wi-Fi password never reaches GitHub.
#pragma once

#define WIFI_SSID     "YOUR_HOTSPOT_NAME"
#define WIFI_PASSWORD "YOUR_HOTSPOT_PASSWORD"

// Laptop running the dashboard. 192.168.137.1 is the laptop's own address
// when it hosts a Windows Mobile Hotspot, so this default works as-is there.
#define SERVER_HOST "192.168.137.1"
#define SERVER_PORT 5000
