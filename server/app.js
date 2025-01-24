const { MongoClient } = require("mongodb");
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { DateTime } = require("luxon"); // Для работы с датами и временем
const dotenv = require("dotenv");
const { getDataFromApi } = require("../parse/meteoraAPI.js");
const cron = require("node-cron");
dotenv.config();

const app = express();
const port = 3000;

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_API; // Токен вашего бота

// Настройки MongoDB
const MONGO_URI = "mongodb://localhost:27017/"; // Подключение к MongoDB
const DB_NAME = "meteoraFarm"; // Имя вашей базы данных
const COLLECTION_NAME = "tokens"; // Имя коллекции
const USERS_COLLECTION = "telegramUsers";

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Подключение к MongoDB
async function connectToMongo() {
  const client = new MongoClient(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect();
  const db = client.db(DB_NAME);
  const collectionUsers = db.collection(USERS_COLLECTION);
  const collectionTokens = db.collection(COLLECTION_NAME);

  return { client, collectionUsers, collectionTokens };
}

// Обновленная функция отправки уведомлений
async function sendTelegramNotification(message) {
  const bot = new TelegramBot(TELEGRAM_TOKEN);
  const { client, collectionTokens, collectionUsers } =
    await MongoClient.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }).then((client) => ({
      client,
      collectionUsers: client.db(DB_NAME).collection("telegramUsers"),
      collectionTokens: client.db(DB_NAME).collection("tokens"),
    }));

  try {
    // Получаем всех активных подписчиков
    const subscribers = await collectionUsers
      .find({ subscribed: true })
      .toArray();

    // Отправляем сообщение каждому подписчику
    for (const subscriber of subscribers) {
      try {
        await bot.sendMessage(subscriber.chatId, message, {
          parse_mode: "HTML",
        });
        console.log(`Сообщение отправлено пользователю ${subscriber.username}`);
      } catch (error) {
        console.error(
          `Ошибка отправки сообщения пользователю ${subscriber.username}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error("Ошибка при отправке уведомлений:", error);
  } finally {
    await client.close();
  }
}

// Основная логика
async function checkAndNotify() {
  const { client, collectionTokens } = await connectToMongo();

  try {
    // Получаем новые данные из API и записываем в БД
    await getDataFromApi();

    // Проверяем наличие уникальных и неотправленных записей
    const result = await collectionTokens
      .aggregate([
        // Группируем по полю pair и подсчитываем количество
        {
          $group: {
            _id: "$pair",
            count: { $sum: 1 },
            firstRecord: { $first: "$$ROOT" },
          },
        },
        // Оставляем только уникальные записи, которые еще не были отправлены
        {
          $match: {
            count: 1,
            "firstRecord.notified": { $ne: true },
          },
        },
        // Проекция для форматирования результата
        {
          $project: {
            _id: 0,
            pair: "$firstRecord.pair",
            name: "$firstRecord.name",
            price: "$firstRecord.current_price",
            liquidity: "$firstRecord.liquidity",
            apr: "$firstRecord.apr",
            date: "$firstRecord.date",
            mint_x: "$firstRecord.mint_x",
            binStep: '$firstRecord.binStep',
            volume24h: '$firstRecord.volume24h',
            volume6h: '$firstRecord.volume6h',
            volume1h: '$firstRecord.volume1h',
            volume5m: '$firstRecord.volume5m',
          },
        },
      ])
      .toArray();

    if (result.length === 0) {
      console.log("Нет новых уникальных неотправленных записей");
      return;
    }

    // Отправляем каждую запись отдельным сообщением
    for (const record of result) {
      // Форматируем дату в UTC+3
      const formattedDate = DateTime.fromJSDate(new Date(record.date))
        .setZone('Europe/Moscow')  // UTC+3
        .toFormat('dd.MM.yy HH:mm:ss');

      const message = `Пара: ${record.name} \nКонтракт пары: ${record.pair} \n\nЛиквидность: ${record.liquidity} $\nBinStep: ${record.binStep}\nЦена: ${record.price} $\nAPR: ${record.apr} %\nОбъем: \n24h: ${record.volume24h}$ \n6h: ${record.volume6h}$ \n1h: ${record.volume1h}$ \n5m: ${record.volume5m}$\n ${formattedDate} (UTC +3) `;

      // Отправляем уведомление для каждой записи
      await sendTelegramNotification(message);

      // Помечаем запись как отправленную
      await collectionTokens.updateOne(
        { pair: record.pair },
        { $set: { notified: true } }
      );

      // Добавляем небольшую задержку между сообщениями
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("Ошибка при работе с MongoDB:", error);
  } finally {
    await client.close();
  }
}

cron.schedule("* * * * *", () => {
  console.log("Проверка записи в базе данных...");
  checkAndNotify();
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || "Anonymous";

  const { client, collectionUsers } = await connectToMongo();

  try {
    // Проверяем, существует ли уже пользователь
    const existingUser = await collectionUsers.findOne({ chatId });

    if (!existingUser) {
      // Добавляем нового пользователя
      await collectionUsers.insertOne({
        chatId,
        username,
        subscribed: true,
        subscribedAt: new Date(),
      });
      await bot.sendMessage(chatId, "Вы успешно подписались на уведомления!");
    } else {
      // Если пользователь уже существует, но отписан
      if (!existingUser.subscribed) {
        await collectionUsers.updateOne(
          { chatId },
          { $set: { subscribed: true } }
        );
        await bot.sendMessage(chatId, "Вы снова подписались на уведомления!");
      } else {
        await bot.sendMessage(chatId, "Вы уже подписаны на уведомления!");
      }
    }
  } catch (error) {
    console.error("Ошибка при сохранении пользователя:", error);
    await bot.sendMessage(chatId, "Произошла ошибка при подписке.");
  } finally {
    await client.close();
  }
});

// Обработка команды /stop
bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id;
  const { client, collectionUsers } = await connectToMongo();

  try {
    await collectionUsers.updateOne(
      { chatId },
      { $set: { subscribed: false } }
    );
    await bot.sendMessage(chatId, "Вы отписались от уведомлений.");
  } catch (error) {
    console.error("Ошибка при отписке пользователя:", error);
  } finally {
    await client.close();
  }
});
