
async function getVolume(mint_x, pair) {
  const url = `https://api.dexscreener.com/token-pairs/v1/solana/${mint_x}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

      for (const pairData of data) {
        // Проверяем совпадение адреса пары
        if (pairData.pairAddress === pair) {
          const volume24h = pairData.volume?.h24 || 0;
          const volume6h = pairData.volume?.h6 || 0;
          const volume1h = pairData.volume?.h1 || 0;
          const volume5m = pairData.volume?.m5 || 0;
                    
          return {
            volume24h,
            volume6h,
            volume1h,
            volume5m
          };
        }
      }
    
  } catch (error) {
    console.error("Ошибка при получении данных объема: ", error);
    return {
      volume24h: 0,
      volume6h: 0,
      volume1h: 0,
      volume5m: 0
    };
  }
}

module.exports = { getVolume };

