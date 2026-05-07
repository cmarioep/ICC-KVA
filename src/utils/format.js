export const formatNumber = (number, decimals = 2) =>
  isFinite(number) && number != null ? number.toFixed(decimals) : "∞";
