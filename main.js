/**
 * main.js — BoschEBike SuuntoPlus app
 *
 * Connects to the Bosch LDI BLE service (exposed by the ESP32 bridge or
 * directly by the bike) and decodes the protobuf payload to display live
 * telemetry on the watch face during a workout.
 *
 * ── BLE protocol overview ────────────────────────────────────────────────────
 * Service UUID:        0000eb20-eaa2-11e9-81b4-2a2ae2dbcce4
 * Characteristic UUID: 0000eb21-eaa2-11e9-81b4-2a2ae2dbcce4  (notify)
 *
 * The characteristic sends unsolicited BLE notifications. Each notification
 * payload is a Protobuf binary message (wire format, no length prefix).
 *
 * ── Protobuf field map ───────────────────────────────────────────────────────
 * Field  Wire  Value
 *   1    varint  speed × 100  (divide by 100 → km/h, integer truncated here)
 *   2    varint  cadence (rpm)
 *   5    varint  motor power (W)
 *   9    varint  ambient light × 1000 (divide by 1000 → lux, not used here)
 *  10    varint  battery state of charge (%)
 *  12    varint  odometer × 1000 (divide by 1000 → km, integer truncated)
 *  17    varint  bike light state: 0 = off, 1 = on, 2 = auto
 *  21    varint  system locked (0/1)
 *  22    varint  charger connected (0/1)
 *  23    varint  light reserve active (0/1)
 *  24    varint  diagnostics active (0/1)
 *  25    varint  not driving / bike stationary (0/1)
 *
 * ── BLE event IDs (bleEventHandler) ──────────────────────────────────────────
 *  100  Connected (BLE link established)
 *  101  Disconnected
 *  106  Notification received  (data payload in `data` argument)
 *  107  Characteristic registered (ready to receive notifications)
 *  109  Notifications enabled  (CCCD write acknowledged by peripheral)
 *
 * ── State machine ─────────────────────────────────────────────────────────────
 *  0   → load ext1 (connect), wait
 *  1   → load ext2 (register char), wait
 *  4   → enable notifications (enaCharNotf), wait
 *  5   → disconnected: clear outputs
 *  6   → notifications enabled: mark ready if exercise started
 *  10  → readyState: decode incoming notifications, update outputs
 *  99  → waitingState: idle, waiting for next async event
 */

var connection, registered, exerciseStarted, state;
var speed, cadence, power, battery, odo, charger, light, noBike, ext;
var maxCad, sumCad, cntCad;
var maxPow, sumPow, cntPow;
var powerBarMax, simSweepValue, simSweepDir;

var SIMULATE_SWEEP = false;

var waitingState = 99, readyState = 10;
var bridgeNoEbikeField = 100;

/**
 * Decode a protobuf varint from a byte array.
 * Reads bytes until the MSB is 0, accumulating 7-bit groups.
 * Returns { v: decoded value, p: next byte position }.
 */
var readVarint = function(data, pos) {
  var v = 0, shift = 0, b;
  do {
    b = data[pos++];
    v += (b & 0x7f) << shift;
    shift += 7;
  } while ((b & 0x80) && pos < data.length);
  return { v: v, p: pos };
};

/**
 * Parse a raw Bosch LDI protobuf notification payload.
 * Updates the module-level speed/cadence/power/battery/odo/light/charger vars.
 * Unknown fields and length-delimited fields (wire type 2) are skipped.
 */
var parseLiveData = function(data) {
  var pos = 0, r, fn, wt;
  noBike = 0;
  while (pos < data.length) {
    r = readVarint(data, pos); pos = r.p;
    fn = r.v >> 3;   // field number (upper bits of tag)
    wt = r.v & 7;    // wire type  (lower 3 bits of tag)
    if (wt === 0) {
      // varint field
      r = readVarint(data, pos); pos = r.p;
      if (fn === 1)       speed   = (r.v / 100) | 0;           // km/h (integer)
      else if (fn === 2)  cadence = r.v;                        // rpm
      else if (fn === 5)  power   = r.v;                        // W
      else if (fn === 10) battery = r.v;                        // %
      else if (fn === 12) odo     = (r.v / 1000) | 0;          // km (integer)
      else if (fn === 17) light   = r.v !== 0 ? 1 : 0;  // any active state (on/auto) → 1, off → 0
      else if (fn === 22) charger = r.v;                        // 0/1
      else if (fn === bridgeNoEbikeField) noBike = r.v ? 1 : 0; // ESP32 bridge: eBike link down
    } else if (wt === 2) {
      // length-delimited field (string/bytes/embedded message) — skip
      r = readVarint(data, pos); pos = r.p + r.v;
    } else { break; }   // unknown wire type, stop parsing
  }
};

/**
 * BLE event handler — drives the connection state machine.
 * Called by the runtime on every BLE event for this app's connection.
 */
var bleEventHandler = function(characteristicId, eventId, data) {
  switch (eventId) {
    case 100: state = registered ? 4 : 1; break;  // connected: register char or enable notif
    case 107: registered = 1; state = 4;  break;  // char registered: enable notifications
    case 101: state = 5;                  break;  // disconnected
    case 109: state = 6;                  break;  // notifications enabled
    case 106: if (state === readyState) parseLiveData(data); break;  // incoming notification
  }
};

var loadExt = function(ix) {
  ext = undefined;
  ext = evalFile('{file_path}/ext' + ix + '.js');
};

var loadSettings = function() {
  var settings = typeof localStorage !== "undefined" ? localStorage.getObject("appSettings") : undefined;
  powerBarMax = settings && settings.powerBarMax ? settings.powerBarMax : 500;
  if (powerBarMax < 100) powerBarMax = 100;
};

var powerToBarLevel = function(value) {
  var level;
  if (value === undefined || powerBarMax === undefined || powerBarMax <= 0) return 0;
  level = ((value * 10 + powerBarMax - 1) / powerBarMax) | 0;
  if (level < 0) return 0;
  if (level > 10) return 10;
  return level;
};

var percentToBarLevel = function(value) {
  var level;
  if (value === undefined) return 0;
  level = ((value + 9) / 10) | 0;
  if (level < 0) return 0;
  if (level > 10) return 10;
  return level;
};

var writeLiveOutputs = function(output) {
  output.speed   = speed;
  output.cadence = cadence;
  output.power   = power;
  output.battery = battery;
  output.odo     = odo;
  output.charger = charger;
  output.light   = light;
  output.noBike  = noBike || 0;
  output.powerBarLevel = powerToBarLevel(power);
  output.batteryBarLevel = percentToBarLevel(battery);
};

var updateStats = function() {
  if (cadence !== undefined) {
    if (maxCad === undefined || cadence > maxCad) maxCad = cadence;
    sumCad = (sumCad || 0) + cadence; cntCad = (cntCad || 0) + 1;
  }
  if (power !== undefined) {
    if (maxPow === undefined || power > maxPow) maxPow = power;
    sumPow = (sumPow || 0) + power; cntPow = (cntPow || 0) + 1;
  }
};

var evaluateSimulation = function(output) {
  var maxPower = powerBarMax || 500;
  simSweepValue += simSweepDir * 25;
  if (simSweepValue >= maxPower) {
    simSweepValue = maxPower;
    simSweepDir = -1;
  } else if (simSweepValue <= 0) {
    simSweepValue = 0;
    simSweepDir = 1;
  }

  speed = ((simSweepValue * 45) / maxPower) | 0;
  cadence = ((simSweepValue * 120) / maxPower) | 0;
  power = simSweepValue | 0;
  battery = ((simSweepValue * 100) / maxPower) | 0;
  odo = ((simSweepValue * 999) / maxPower) | 0;
  charger = 0;
  light = power > (maxPower / 2) ? 1 : 0;
  noBike = 0;

  output.con = 1;
  writeLiveOutputs(output);
  if (exerciseStarted) updateStats();
};

/**
 * evaluate() — called by the Suunto runtime on every sensor tick.
 * Advances the state machine and writes decoded values to the output object.
 */
function evaluate(input, output) {
  if (SIMULATE_SWEEP) {
    evaluateSimulation(output);
    return;
  }

  switch (state) {
    case 0:
      // Initiate BLE scan + connect (ext1 returns the connection handle)
      loadExt(1);
      connection = ext(bleEventHandler);
      state = waitingState;
      break;
    case 1:
      // Register the LDI characteristic for notifications
      loadExt(2);
      ext(connection);
      state = waitingState;
      break;
    case 4:
      // Enable BLE notifications (writes CCCD 0x0001 to the characteristic)
      appConn.enaCharNotf(connection, 0);
      state = waitingState;
      break;
    case 5:
      // BLE disconnected: clear all outputs
      output.con = 0;
      speed = cadence = power = battery = odo = charger = light = undefined;
      output.speed = output.cadence = output.power = output.battery = output.odo = output.charger = output.light = undefined;
      noBike = 0;
      output.noBike = 0;
      output.powerBarLevel = 0;
      output.batteryBarLevel = 0;
      state = waitingState;
      break;
    case 6:
      // Notifications enabled: mark connected; only start data flow after exercise starts
      output.con = 1;
      if (exerciseStarted) {
        speed   = speed   !== undefined ? speed   : 0;
        cadence = cadence !== undefined ? cadence : 0;
        power   = power   !== undefined ? power   : 0;
        battery = battery !== undefined ? battery : 0;
        odo     = odo     !== undefined ? odo     : 0;
        charger = charger !== undefined ? charger : 0;
        light   = light   !== undefined ? light   : 0;
        state = readyState;
      }
      break;
    case waitingState:
      break;
    case readyState:
      // Forward latest decoded values to watch outputs every tick
      writeLiveOutputs(output);
      // Accumulate stats for end-of-exercise summary
      updateStats();
      break;
  }
}

/** Called once when the app is loaded into a workout screen. */
function onLoad(input, output) {
  output.con = exerciseStarted = registered = state = 0;
  speed = cadence = power = battery = odo = charger = light = undefined;
  output.speed = output.cadence = output.power = output.battery = output.odo = output.charger = output.light = undefined;
  noBike = 0;
  output.noBike = 0;
  output.powerBarLevel = 0;
  output.batteryBarLevel = 0;
  maxCad = sumCad = cntCad = undefined;
  maxPow = sumPow = cntPow = undefined;
  simSweepValue = 0;
  simSweepDir = 1;
  loadSettings();
}

/** Called when the user starts recording an exercise. */
function onExerciseStart() { exerciseStarted = 1; }

/** Returns the watch face template file name. */
function getUserInterface() { return { template: 't' }; }

/**
 * Returns the post-workout summary fields shown on the summary screen.
 * Includes max and average cadence/power accumulated during the exercise.
 */
function getSummaryOutputs(input, output) {
  var avg = function(s, c) { return c ? ((s / c + 0.5) | 0) : undefined; };
  return [
    { id: 'mc', name: 'Max cadence rpm',  format: 'Count_Threedigits', value: maxCad },
    { id: 'ac', name: 'Avg cadence rpm',  format: 'Count_Threedigits', value: avg(sumCad, cntCad) },
    { id: 'mp', name: 'Max power W',      format: 'Count_Fourdigits',  value: maxPow },
    { id: 'ap', name: 'Avg power W',      format: 'Count_Fourdigits',  value: avg(sumPow, cntPow) },
  ];
}
