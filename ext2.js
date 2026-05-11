// Register LDI Live Data characteristic for notifications
// Service UUID:        0000eb20-eaa2-11e9-81b4-2a2ae2dbcce4 (little-endian)
// Characteristic UUID: 0000eb21-eaa2-11e9-81b4-2a2ae2dbcce4 (little-endian)
function(conn) {
  appConn.regUuid(conn,
    0,
    [228, 204, 219, 226, 42, 42, 180, 129, 233, 17, 162, 234, 32, 235, 0, 0],
    [228, 204, 219, 226, 42, 42, 180, 129, 233, 17, 162, 234, 33, 235, 0, 0]
  );
}
