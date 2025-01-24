const mongoose = require('mongoose');

// Строка подключения к базе данных MongoDB
const uri = 'mongodb://localhost:27017/meteoraFarm'; // Укажите свой URI

// Подключение к MongoDB
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Подключение к базе данных MongoDB успешно');
}).catch(err => {
  console.error('Ошибка подключения к MongoDB:', err);
});

// Пример создания модели и вставки данных
const Schema = mongoose.Schema;
const tokenSchema = new mongoose.Schema({
    name: {
      type: String, 
      required: true
    },
    mint_x:{
      type: String,
      required: true
    },
    current_price:{
      type: Number,
      required:true
    },
    pair:{
      type: String,
      required: true
    },
    liquidity: {
      type: Number, 
      required: true
    },
    apr: {
      type: Number, 
      required: true
    },
    date: {
      type: Date, 
      default: new Date() // если не указана дата, будет использоваться текущая дата
    },
    notified: {
      type: Boolean, 
      default: false // если не указана дата, будет использоваться текущая дата
    },
    binStep:{
      type: Number,
      required: true
    },
    volume24h:{
      type: Number,
      required: true
    },
    volume6h:{
      type: Number,
      required: true
    },
    volume1h:{
      type: Number,
      required: true
    },
    volume5m:{
      type: Number,
      required: true
    }
  });

  const Token = mongoose.model('Token', tokenSchema);

  async function addTokenData(name,mint_x,current_price,pair,liquidity,apr,binStep,volume24h, volume6h, volume1h, volume5m) {
    const newTokenData = new Token({
      name,
      mint_x,
      current_price,
      pair,
      liquidity,
      apr,
      binStep,
      volume24h,
      volume6h,
      volume1h,
      volume5m
    });
  
    try {
      const savedTokenData = await newTokenData.save();
      // console.log('Данные успешно сохранены:');
    } catch (err) {
      console.error('Ошибка при сохранении данных:', err);
    }
  }

  module.exports = { addTokenData };


