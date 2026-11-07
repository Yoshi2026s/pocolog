// Coin requirements transcribed from the user's 「条件1」 reference table.
// Each account/liver pair reaches its own cheer level: convert cells before summing.
(() => {
  const tiers = [
    [0.01, 1], [0.05, 5], [0.1, 10], [0.5, 50],
    [1, 100], [2, 200], [3, 400], [4, 700], [5, 1000],
    [6, 1400], [7, 1800], [8, 2200], [9, 2600], [10, 3000],
    [11, 4000], [12, 5500], [13, 7000], [14, 8500], [15, 10000],
    [16, 12000], [17, 14000], [18, 16000], [19, 18000], [20, 20000],
    [21, 22000], [22, 24000], [23, 26000], [24, 28000], [25, 30000],
    [26, 34000], [27, 38000], [28, 42000], [29, 46000], [30, 50000],
    [32, 60000], [34, 70000], [36, 80000], [38, 90000], [40, 100000],
    [42, 125000], [44, 150000], [46, 200000], [48, 250000]
  ];
  const lookup = new Map([[0, 0], ...tiers]);
  // Condition 1 viewing thresholds from the official Pococha core fan FAQ.
  // https://pococha-jp.pococha.com/hc/ja/articles/31868221880857
  const viewingByLevel = new Map([
    [0.1, 90], [0.5, 120], [1, 180], [5, 300], [10, 420], [15, 570],
    [20, 750], [25, 960], [30, 1200], [35, 1350], [40, 1500]
  ]);
  const viewingMinutes = level => viewingByLevel.get(level) ?? null;
  function convert(value) {
    const text = String(value).trim();
    if (!text) return { status: 'blank', coins: null };
    if (/^[○〇◯]$/.test(text)) return { status: 'check', coins: null };
    if (!/^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return { status: 'invalid', coins: null };
    const level = Number(text);
    if (!lookup.has(level)) return { status: 'unlisted', coins: null };
    return { status: 'known', coins: lookup.get(level) };
  }
  function summarize(values) {
    return values.reduce((result, value) => {
      const converted = convert(value);
      if (converted.status === 'known') result.coins += converted.coins;
      if (['invalid', 'unlisted'].includes(converted.status)) result.unknown++;
      return result;
    }, { coins: 0, unknown: 0 });
  }
  globalThis.PocoCoins = Object.freeze({ tiers: tiers.map(tier => Object.freeze(tier)), convert, summarize, viewingMinutes });
})();
