/**
 * ext1.js — BLE connection to the BoschEBike ESP32 bridge
 *
 * Scans for a BLE peripheral advertising the Bosch LDI service UUID and
 * connects to it. In practice this connects to the ESP32 bridge, which
 * mimics the bike's GATT server so the watch sees it as a real Bosch eBike.
 *
 * Bosch LDI service UUID (little-endian byte array):
 *   0000eb20-eaa2-11e9-81b4-2a2ae2dbcce4
 *
 * appConn.connect() arguments:
 *   1. enabledZappId  — app identifier provided by the runtime
 *   2. evHandler      — BLE event callback (defined in main.js)
 *   3. service UUID   — 17-byte array: [AD type 0x07, UUID bytes LE]
 *   4. solicitation   — 17-byte array: [AD type 0x06, UUID bytes LE]
 *      The watch scans for both the complete service UUID (0x07) and the
 *      solicitation UUID (0x06) so it can find either the real bike or the
 *      bridge depending on which advertising phase is active.
 *
 * Returns: a connection handle passed to ext2.js for characteristic registration.
 */
function(evHandler) {
  return appConn.connect(
    enabledZappId,
    evHandler,
    [7, 228, 204, 219, 226, 42, 42, 180, 129, 233, 17, 162, 234, 32, 235, 0, 0],
    [6, 228, 204, 219, 226, 42, 42, 180, 129, 233, 17, 162, 234, 32, 235, 0, 0]
  );
}
