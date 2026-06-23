import {
  electrictParamsAWG,
  electrictParams15XLPE,
  electrictParamsACSR,
} from "./cableParams";

const POWER_FACTOR     = 0.9;
const SIN_POWER_FACTOR = Math.sin(Math.acos(POWER_FACTOR)); // ≈ 0.4359

export function getRXL(type, gauge, material = "Cobre", canal = "PVC") {
  const gaugeStr = String(gauge);
  const gaugeNum = parseFloat(gaugeStr);
  const lookupByGauge = (obj) => obj?.[gaugeStr] ?? obj?.[gaugeNum] ?? 0;

  if (type === "ACSR") {
    return {
      R:  lookupByGauge(electrictParamsACSR.resistance),
      XL: lookupByGauge(electrictParamsACSR.inductance),
    };
  }
  if (type === "BT600") {
    return {
      R:  lookupByGauge(electrictParamsAWG.resistance[material]?.[canal]),
      XL: lookupByGauge(electrictParamsAWG.inductance[canal]),
    };
  }
  // MT15
  return {
    R:  lookupByGauge(electrictParams15XLPE.resistance[material]?.[canal]),
    XL: lookupByGauge(electrictParams15XLPE.inductance[canal]),
  };
}

// Z(Ω/km) = R·fp + XL·sen(acos(fp))
export function getZ(type, gauge, material = "Cobre", canal = "PVC") {
  const { R, XL } = getRXL(type, gauge, material, canal);
  return R * POWER_FACTOR + XL * SIN_POWER_FACTOR;
}

export function getGauges(type, material = "Cobre", canal = "PVC") {
  if (type === "ACSR")  return Object.keys(electrictParamsACSR.resistance).map(String);
  if (type === "BT600") return Object.keys(electrictParamsAWG.resistance[material]?.[canal] ?? {}).map(String);
  return Object.keys(electrictParams15XLPE.resistance[material]?.[canal] ?? {}).map(String);
}

export function series(a, b) {
  if (!a || !b || a <= 0 || b <= 0) return 0;
  return 1 / (1 / a + 1 / b);
}

// conductorsPerPhase parallel conductors divide the effective impedance by N.
export function cableKVA(kV, impedancePerKm, lengthMeters, conductorsPerPhase = 1) {
  if (!impedancePerKm || !lengthMeters || lengthMeters <= 0) return Infinity;
  const parallel = conductorsPerPhase > 0 ? conductorsPerPhase : 1;
  const lengthKilometers = lengthMeters / 1000;
  return (1000 * kV * kV) / ((impedancePerKm / parallel) * lengthKilometers);
}
