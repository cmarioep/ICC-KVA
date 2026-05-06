import {
  electrictParamsAWG,
  electrictParams15XLPE,
  electrictParamsACSR,
} from "./cableParams";

const FP = 0.9;
const SEN_FP = Math.sin(Math.acos(FP)); // ≈ 0.4359

export function getRXL(type, gauge, material = "Cobre", canal = "PVC") {
  const g = String(gauge);
  const gn = parseFloat(g);
  const look = (obj) => obj?.[g] ?? obj?.[gn] ?? 0;
  if (type === "ACSR") {
    return {
      R: look(electrictParamsACSR.resistance),
      XL: look(electrictParamsACSR.inductance),
    };
  }
  if (type === "BT600") {
    return {
      R: look(electrictParamsAWG.resistance[material]?.[canal]),
      XL: look(electrictParamsAWG.inductance[canal]),
    };
  }
  // MT15
  return {
    R: look(electrictParams15XLPE.resistance[material]?.[canal]),
    XL: look(electrictParams15XLPE.inductance[canal]),
  };
}

// Z(Ω/km) = R·fp + XL·sen(acos(fp))
export function getZ(type, gauge, material = "Cobre", canal = "PVC") {
  const { R, XL } = getRXL(type, gauge, material, canal);
  return R * FP + XL * SEN_FP;
}

export function getGauges(type, material = "Cobre", canal = "PVC") {
  if (type === "ACSR") return Object.keys(electrictParamsACSR.resistance).map(String);
  if (type === "BT600") return Object.keys(electrictParamsAWG.resistance[material]?.[canal] ?? {}).map(String);
  return Object.keys(electrictParams15XLPE.resistance[material]?.[canal] ?? {}).map(String);
}

export function series(a, b) {
  if (!a || !b || a <= 0 || b <= 0) return 0;
  return 1 / (1 / a + 1 / b);
}

export function cableKVA(kV, Zokm, len_m) {
  if (!Zokm || !len_m || len_m <= 0) return Infinity;
  const len_km = len_m / 1000;
  return (1000 * kV * kV) / (Zokm * len_km);
}
