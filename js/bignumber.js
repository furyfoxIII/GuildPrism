// =========================================================================
// Bignumber engine
// A small, self-contained "break_infinity.js"-style Decimal: every value is
// stored as { m, e } meaning m * 10^e, with m normalized to (-10,-1] U [1,10)
// (or exactly {m:0,e:0} for zero). This keeps arithmetic cheap while letting
// totals grow far beyond what a plain JS number/localeString could format
// sensibly, and lets us render/parse the standard incremental-game suffix
// ladder (k, b, t, qd, qn, sx, sp, oc, no, de, ude, dde, tde, qdde, qnde,
// sxde, spde, ocde, node, vt, tg) directly, with a scientific-notation
// fallback once a value grows past what any suffix tier can express cleanly.
// =========================================================================
window.App = window.App || {};

(function(){
  const SUFFIXES = [
    ['k', 3], ['b', 9], ['t', 12],
    ['qd', 15], ['qn', 18], ['sx', 21], ['sp', 24], ['oc', 27], ['no', 30],
    ['de', 33], ['ude', 36], ['dde', 39], ['tde', 42], ['qdde', 45], ['qnde', 48],
    ['sxde', 51], ['spde', 54], ['ocde', 57], ['node', 60],
    ['vt', 63], ['tg', 93],
  ];
  const SUFFIX_MAP = {};
  SUFFIXES.forEach(([s, exp]) => { SUFFIX_MAP[s] = exp; });

  const BN = {
    zero(){ return { m: 0, e: 0 }; },

    normalize(m, e){
      if (!isFinite(m) || isNaN(m) || m === 0) return { m: 0, e: 0 };
      const sign = m < 0 ? -1 : 1;
      let am = Math.abs(m);
      while (am !== 0 && am < 1) { am *= 10; e -= 1; }
      while (am >= 10) { am /= 10; e += 1; }
      return { m: am * sign, e };
    },

    fromNumber(n){
      n = Number(n);
      if (!isFinite(n) || isNaN(n) || n === 0) return { m: 0, e: 0 };
      const sign = n < 0 ? -1 : 1;
      const abs = Math.abs(n);
      let e = Math.floor(Math.log10(abs));
      let m = abs / Math.pow(10, e);
      if (m >= 10) { m /= 10; e += 1; }
      if (m < 1) { m *= 10; e -= 1; }
      return BN.normalize(sign * m, e);
    },

    add(a, b){
      if (a.m === 0) return b;
      if (b.m === 0) return a;
      const big = a.e >= b.e ? a : b;
      const small = a.e >= b.e ? b : a;
      const diff = big.e - small.e;
      if (diff > 17) return big; // smaller term is negligible at double precision
      const m = big.m + small.m / Math.pow(10, diff);
      return BN.normalize(m, big.e);
    },

    neg(a){ return a.m === 0 ? a : { m: -a.m, e: a.e }; },
    sub(a, b){ return BN.add(a, BN.neg(b)); },

    cmp(a, b){
      const d = BN.sub(a, b);
      if (d.m === 0) return 0;
      return d.m > 0 ? 1 : -1;
    },

    isZero(a){ return a.m === 0; },
    isNeg(a){ return a.m < 0; },
    toNumber(a){ return a.m * Math.pow(10, a.e); },

    // Safe-ish a/b as a plain JS number — used only for chart-bar height ratios.
    ratio(a, b){
      if (a.m === 0 || b.m === 0) return 0;
      const diff = a.e - b.e;
      if (diff > 300) return Infinity;
      if (diff < -300) return 0;
      const r = (a.m / b.m) * Math.pow(10, diff);
      return isFinite(r) ? r : 0;
    },

    // Parses plain numbers, scientific notation, or suffixed strings
    // ("1500", "1.5k", "4.2qd", "1.23e45", numbers with commas, etc).
    // Returns a BN, or null if the input isn't a valid number.
    parse(input){
      if (input === null || input === undefined) return null;
      if (typeof input === 'number') return BN.fromNumber(input);
      const str = String(input).trim();
      if (!str) return null;
      if (/^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) {
        const n = Number(str);
        return isNaN(n) ? null : BN.fromNumber(n);
      }
      const m = str.match(/^(-?[\d,]*\.?\d+)\s*([a-zA-Z]*)$/);
      if (!m) return null;
      const numPart = m[1].replace(/,/g, '');
      const suffixPart = m[2].toLowerCase();
      const n = Number(numPart);
      if (isNaN(n)) return null;
      const base = BN.fromNumber(n);
      if (!suffixPart) return base;
      if (!(suffixPart in SUFFIX_MAP)) return null;
      return BN.normalize(base.m, base.e + SUFFIX_MAP[suffixPart]);
    },

    // Formats a BN using the suffix ladder, falling back to scientific
    // notation once a value has grown past what the nearest tier can show
    // with a sane mantissa (i.e. beyond the ~e63-e92 and >=e99 gaps).
    format(a){
      if (!a || a.m === 0) return '0';
      const neg = a.m < 0;
      const absM = Math.abs(a.m);
      const e = a.e;
      let out;
      if (e < 3) {
        out = (absM * Math.pow(10, e)).toLocaleString(undefined, { maximumFractionDigits: 2 });
      } else {
        let tier = null;
        for (const s of SUFFIXES) { if (s[1] <= e) tier = s; else break; }
        if (!tier) {
          out = (absM * Math.pow(10, e)).toLocaleString(undefined, { maximumFractionDigits: 2 });
        } else {
          const mantExp = e - tier[1];
          if (mantExp > 6) {
            out = absM.toFixed(2) + 'e+' + e;
          } else {
            const mant = absM * Math.pow(10, mantExp);
            out = mant.toLocaleString(undefined, { maximumFractionDigits: 2 }) + tier[0];
          }
        }
      }
      return (neg ? '-' : '') + out;
    },

    // A spreadsheet-friendly value for export: a plain number for normal
    // ranges (so Excel keeps it numeric), or an exact scientific-notation
    // string for anything too large to round-trip as a double cleanly.
    toStorageValue(a){
      if (!a || a.m === 0) return 0;
      if (a.e < 15 && a.e > -7) {
        return Math.round(BN.toNumber(a) * 1e6) / 1e6;
      }
      const m = a.m.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
      return m + 'e' + a.e;
    },
  };

  window.App.BN = BN;
})();
