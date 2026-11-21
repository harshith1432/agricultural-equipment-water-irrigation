#!/system/bin/sh
# BLE scanner using Android's dumpsys gatt to list connected/bonded BLE devices
# and discover what GATT services the spectroscope exposes

echo "=== Android BLE GATT Service Discovery ==="
echo ""

echo "--- Bonded BLE devices ---"
dumpsys bluetooth_manager 2>/dev/null | grep -A 2 "address\|name\|Connected\|bonded" | head -60

echo ""
echo "--- Active GATT connections ---"
dumpsys gatt 2>/dev/null | head -100

echo ""
echo "--- BLE scan results ---"
dumpsys activity service com.android.bluetooth.BluetoothManagerService 2>/dev/null | head -50
