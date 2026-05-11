var connection, registered, exerciseStarted, state;
var speed, cadence, power, battery, odo, charger, light, ext;
var maxCad, sumCad, cntCad;
var maxPow, sumPow, cntPow;

var waitingState = 99, readyState = 10;

var readVarint = function(data, pos) {
  var v = 0, shift = 0, b;
  do {
    b = data[pos++];
    v += (b & 0x7f) << shift;
    shift += 7;
  } while ((b & 0x80) && pos < data.length);
  return { v: v, p: pos };
};

var parseLiveData = function(data) {
  var pos = 0, r, fn, wt;
  while (pos < data.length) {
    r = readVarint(data, pos); pos = r.p;
    fn = r.v >> 3; wt = r.v & 7;
    if (wt === 0) {
      r = readVarint(data, pos); pos = r.p;
      if (fn === 1)       speed   = (r.v / 100) | 0;
      else if (fn === 2)  cadence = r.v;
      else if (fn === 5)  power   = r.v;
      else if (fn === 10) battery = r.v;
      else if (fn === 12) odo     = (r.v / 1000) | 0;
      else if (fn === 17) light   = r.v === 2 ? 1 : r.v === 1 ? 0 : undefined;
      else if (fn === 22) charger = r.v;
    } else if (wt === 2) {
      r = readVarint(data, pos); pos = r.p + r.v;
    } else { break; }
  }
};

var bleEventHandler = function(characteristicId, eventId, data) {
  switch (eventId) {
    case 100: state = registered ? 4 : 1; break;
    case 107: registered = 1; state = 4;  break;
    case 101: state = 5;                  break;
    case 109: state = 6;                  break;
    case 106: if (state === readyState) parseLiveData(data); break;
  }
};

var loadExt = function(ix) {
  ext = undefined;
  ext = evalFile('{file_path}/ext' + ix + '.js');
};

function evaluate(input, output) {
  switch (state) {
    case 0:
      loadExt(1);
      connection = ext(bleEventHandler);
      state = waitingState;
      break;
    case 1:
      loadExt(2);
      ext(connection);
      state = waitingState;
      break;
    case 4:
      appConn.enaCharNotf(connection, 0);
      state = waitingState;
      break;
    case 5:
      output.con = 0;
      speed = cadence = power = battery = odo = charger = light = undefined;
      output.speed = output.cadence = output.power = output.battery = output.odo = output.charger = output.light = undefined;
      state = waitingState;
      break;
    case 6:
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
      output.speed   = speed;
      output.cadence = cadence;
      output.power   = power;
      output.battery = battery;
      output.odo     = odo;
      output.charger = charger;
      output.light   = light;
      if (cadence !== undefined) {
        if (maxCad === undefined || cadence > maxCad) maxCad = cadence;
        sumCad = (sumCad || 0) + cadence; cntCad = (cntCad || 0) + 1;
      }
      if (power !== undefined) {
        if (maxPow === undefined || power > maxPow) maxPow = power;
        sumPow = (sumPow || 0) + power; cntPow = (cntPow || 0) + 1;
      }
      break;
  }
}

function onLoad(input, output) {
  output.con = exerciseStarted = registered = state = 0;
  speed = cadence = power = battery = odo = charger = light = undefined;
  output.speed = output.cadence = output.power = output.battery = output.odo = output.charger = output.light = undefined;
  maxCad = sumCad = cntCad = undefined;
  maxPow = sumPow = cntPow = undefined;
}

function onExerciseStart() { exerciseStarted = 1; }

function getUserInterface() { return { template: 't' }; }

function getSummaryOutputs(input, output) {
  var avg = function(s, c) { return c ? ((s / c + 0.5) | 0) : undefined; };
  return [
    { id: 'mc', name: 'Cadenza max rpm',   format: 'Count_Threedigits', value: maxCad },
    { id: 'ac', name: 'Cadenza media rpm', format: 'Count_Threedigits', value: avg(sumCad, cntCad) },
    { id: 'mp', name: 'Potenza max W',     format: 'Count_Fourdigits',  value: maxPow },
    { id: 'ap', name: 'Potenza media W',   format: 'Count_Fourdigits',  value: avg(sumPow, cntPow) },
  ];
}
