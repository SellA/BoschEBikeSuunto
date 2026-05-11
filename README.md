# BoschEBike Suunto App

SuuntoPlus (Zapp) app for Suunto watches that displays live data from a **Bosch eBike** via the [BoschEBike ESP32 Bridge](https://github.com/SellA/BoschEBikeESP32).

The app connects over BLE to the ESP32 bridge using the Bosch LDI service UUID and parses the protobuf payload directly on the watch.

## Displayed data

| Field | Unit | Description |
|---|---|---|
| VEL | km/h | Speed |
| CAD | rpm | Cadence |
| POT | W | Motor power |
| BAT | % | Battery state of charge |
| ODO | km | Total odometer |
| ⚡ | — | Charger connected (0/1) |
| 🔦 | — | Light state (0=off, 1=on) |

Summary screen at end of exercise shows max/avg cadence and max/avg power.

## Compatible Suunto watches

Any Suunto watch that supports **SuuntoPlus** (Zapp) apps:

| Watch | Notes |
|---|---|
| Suunto Vertical | Tested |
| Suunto Race / Race S | Compatible |
| Suunto 9 Peak Pro | Compatible |
| Suunto 5 Peak | Compatible |
| Suunto 9 Baro | Compatible |
| Suunto 9 (Gen 1) | Limited SuuntoPlus support |

## Requirements

- The **ESP32 bridge** must be running and connected to the bike (or in simulation mode). See [BoschEBikeESP32](https://github.com/SellA/BoschEBikeESP32).
- **Suunto app** on iOS or Android (to sideload the `.dev` file onto the watch).

## Installation on the Suunto watch

### Method 1 — Suunto app (recommended)

1. Download the latest `.dev` file from this repository (`bosche01-s.dev` is the most recent version)
2. Transfer the `.dev` file to your phone (AirDrop, Google Drive, email, etc.)
3. On your phone, open the `.dev` file with the **Suunto app** — it will offer to install the app on your paired watch
4. Confirm the installation on the watch

### Method 2 — USB (Windows)

1. Connect the Suunto watch to your PC via USB
2. The watch appears as a USB drive
3. Copy the `.dev` file to the `\Suunto\Apps\` folder on the watch
4. Eject the watch safely and restart it

### Activating during a workout

1. Start a new exercise on the watch
2. Swipe to the SuuntoPlus data screen
3. Add **Bosch eBike** from the app list (first time only)
4. The watch searches for the BLE device named `BoschEBike` and connects automatically

## File overview

| File | Description |
|---|---|
| `main.js` | App logic: BLE state machine, protobuf parser, data output |
| `ext1.js` | BLE connection helper — connects to the LDI service UUID |
| `ext2.js` | BLE characteristic notification enable helper |
| `manifest.json` | App metadata (name, version, output field definitions) |
| `t.html` | Watch face template — 2×3 grid layout for circular display |
| `bosche01-*.dev` | Packaged app files ready to install (versioned) |

## How it works

```
Bosch eBike ──► ESP32 Bridge ──BLE LDI──► Suunto watch
                               UUID: 0000eb20-eaa2-11e9-81b4-2a2ae2dbcce4
```

1. The app calls `appConn.connect()` scanning for the LDI service UUID
2. Once connected, it enables notifications on the LDI characteristic (`0000eb21-...`)
3. On each notification, the raw protobuf payload is parsed (field IDs 1, 2, 5, 10, 12, 17, 22)
4. Decoded values are written to the output fields and displayed on screen

## Building a new `.dev` package

`.dev` files are ZIP archives containing the app sources. To build one from source, use the [Suunto Developer Tools](https://www.suunto.com/en-gb/Support/software-support/suuntoplus-apps/) or the official Suunto CLI packager:

```bash
zip -j bosche01-new.dev manifest.json main.js ext1.js ext2.js t.html
mv bosche01-new.dev bosche01-new.dev  # rename with your version suffix
```

## Related

- [BoschEBikeESP32](https://github.com/SellA/BoschEBikeESP32) — the ESP32 firmware that makes this app work
