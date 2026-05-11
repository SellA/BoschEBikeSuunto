// Connect to Bosch eBike searching for LDI Service UUID
// Service UUID: 0000eb20-eaa2-11e9-81b4-2a2ae2dbcce4 (little-endian)
function(evHandler) {
  return appConn.connect(
    enabledZappId,
    evHandler,
    [7, 228, 204, 219, 226, 42, 42, 180, 129, 233, 17, 162, 234, 32, 235, 0, 0],
    [6, 228, 204, 219, 226, 42, 42, 180, 129, 233, 17, 162, 234, 32, 235, 0, 0]
  );
}
