// https://dlmm-api.meteora.ag/swagger-ui/#/pair%3A%3Aroute/all_by_groups
const {addTokenData} = require('../db/mondodb.js');
const {getVolume} = require('../parse/getVolume.js')

async function getDataFromApi() {
    const url = 'https://dlmm-api.meteora.ag/pair/all_by_groups?limit=5000&hide_low_tvl=5000&hide_low_apr=true';
    
    const response = await fetch(url);
    const data = await response.json();
  
    for (let i = 0; i < data.groups.length; i++) {
        for (let j = 0; j < data.groups[i].pairs.length; j++) {
            const volume = data.groups[i].pairs[j].trade_volume_24h;
            const liquidity = parseFloat(data.groups[i].pairs[j].liquidity);
            const apr = data.groups[i].pairs[j].apr;
            const baseFee = data.groups[i].pairs[j].base_fee_percentage;
            const name = data.groups[i].pairs[j].name;
            const pair = data.groups[i].pairs[j].address;
            const current_price = data.groups[i].pairs[j].current_price;
            const mint_x = data.groups[i].pairs[j].mint_x;
            const binStep = data.groups[i].pairs[j].bin_step;

            if((volume/liquidity>1) && (baseFee >=2)&& (volume<50000000)){
                const volumeData = await getVolume(mint_x, pair);
                
                // Проверяем, что volumeData существует
                if (volumeData) {
                    const volume24h = volumeData.volume24h || volume; // Используем резервное значение
                    const volume6h = volumeData.volume6h || 0;
                    const volume1h = volumeData.volume1h || 0;
                    const volume5m = volumeData.volume5m || 0;
                    
                    addTokenData(name, mint_x, current_price, pair, liquidity, apr, binStep, 
                               volume24h, volume6h, volume1h, volume5m);
                } else {
                    console.log(`Не удалось получить данные об объеме для пары ${pair}`);
                    // Используем данные из Meteora API если нет данных от DexScreener
                    addTokenData(name, mint_x, current_price, pair, liquidity, apr, binStep, 
                               volume, 0, 0, 0);
                }
            }
        }        
    }
}

module.exports = {getDataFromApi};


