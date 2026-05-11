/**
 * ext2.js — Register the LDI Live Data characteristic for BLE notifications
 *
 * Registers the Bosch LDI characteristic so the watch runtime subscribes to
 * its notifications (CCCD write 0x0001). Every notification carries a raw
 * protobuf payload with live bike telemetry (see parseLiveData in main.js).
 *
 * Bosch LDI characteristic UUID (little-endian byte array):
 *   0000eb21-eaa2-11e9-81b4-2a2ae2dbcce4
 *   Note: last nibble of byte 13 is 0x21 (characteristic) vs 0x20 (service).
 *
 * appConn.regUuid() arguments:
 *   1. conn            — connection handle from ext1.js
 *   2. characteristic  — characteristic index (0 = first/only characteristic)
 *   3. service UUID    — 16-byte LE array (no AD type prefix here)
 *   4. char UUID       — 16-byte LE array (no AD type prefix here)
 */
function(conn) {
  appConn.regUuid(conn,
    0,
    [228, 204, 219, 226, 42, 42, 180, 129, 233, 17, 162, 234, 32, 235, 0, 0],
    [228, 204, 219, 226, 42, 42, 180, 129, 233, 17, 162, 234, 33, 235, 0, 0]
  );
}
