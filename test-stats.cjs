const jStat = require('jstat');

// Old Normal CDF Approximation
function normalCDF(x) {
  var t = 1 / (1 + 0.2316419 * Math.abs(x));
  var d = 0.3989423 * Math.exp(-x * x / 2);
  var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

// Old Chi-Square (Wilson-Hilferty)
const oldChiSquarePValue = (chiSq, df) => {
  if (df <= 0) return 1;
  const z = (Math.pow(chiSq / df, 1/3) - (1 - 2/(9*df))) / Math.sqrt(2/(9*df));
  return 1 - normalCDF(z);
};

// Example dataset for T-Test
// Small sample size to show the difference
const t = 2.5;
const df_t = 4; // very small df

const p_old_t = 2 * (1 - normalCDF(Math.abs(t)));
const p_new_t = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df_t));

console.log("Welch T-Test (t=2.5, df=4):");
console.log("Old (Normal Approximation):", p_old_t);
console.log("New (jStat Student-t):", p_new_t);
console.log("");

// Example dataset for Chi-Square
// 2x2 table -> df = 1
const chiSq = 3.841; // critical value for alpha=0.05
const df_chi = 1;

const p_old_chi = oldChiSquarePValue(chiSq, df_chi);
const p_new_chi = 1 - jStat.chisquare.cdf(chiSq, df_chi);

console.log("Chi-Square (chiSq=3.841, df=1):");
console.log("Old (Wilson-Hilferty):", p_old_chi);
console.log("New (jStat Chi-Square):", p_new_chi);

