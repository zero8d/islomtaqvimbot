require("dotenv").config()
const { Telegraf } = require("telegraf")
const token = process.env.BOTTOKEN
const bot = new Telegraf(token)
const logChatId = process.env.LOGCHATID
const regions = require("./regions.json")
const regionsru = require("./regionsrus.json")
const mongoose = require("mongoose")
const ProfileModel = require("./models/profile")
const tgboturl = process.env.TGBOTURL
const mongouser = process.env.MONGO_USER
const mongopass = process.env.MONGO_PASS
const axios = require("axios")
const connectionString = `mongodb+srv://${mongouser}:${mongopass}@cluster0.ylloi.mongodb.net/prayertimes?retryWrites=true&w=majority`

mongoose.connect(connectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

const botmsg = {
  ru: {
    choose_region: "Выберите свой регион",
    region_saved: "Ваша территория сохранена, ваша территория: ",
    tashkent_city: "Город Ташкент",
    settings: "Настройки",
    change_region: "Изменить область 📍",
    change_lang: "Сменить язык",
    lang_changed: "Ваш язык изменился. язык по вашему выбору: ",
    today: "Сегодня",
    week: "На неделю",
    go_back: "🔙 Назад",
    command: "Выбрать",
    go_home: "Главное меню",
    respm: {
      region: "Территория",
      date: "Дата",
      tong: "Фаджр (Сухур)",
      quyosh: "Шурук",
      peshin: "Зухр",
      asr: "Аср",
      shom: "Магриб (Ифтар)",
      hufton: "Иша",
    },
  },
  uz: {
    choose_region: "Hududingizni tanlang.",
    region_saved: "Hudidingiz saqlandi, sizning hududingiz: ",
    tashkent_city: "Toshkent shaxri",
    settings: "Sozlamalar",
    change_region: "Hududni o'zgartirish 📍",
    change_lang: "Tilni o'zgartirish. 🧾",
    lang_changed: "Tilingiz o'zgartirildi siz tanlagan til: ",
    today: "Bugun",
    week: "Bir haftalik",
    go_back: "🔙 Orqaga qaytish",
    command: "Buyruq berishingiz mumkin.",
    go_home: "Bosh menyu 🏠",
    respm: {
      region: "Hudud",
      date: "Sana",
      tong: "Tong (Saharlik)",
      quyosh: "Quyosh chiqishi",
      peshin: "Peshin",
      asr: "Asr",
      shom: "Shom (Iftorlik)",
      hufton: "Hufton",
    },
  },
}

bot.action("Bekor qilish", ctx => ctx.deleteMessage())

bot.command("start", ctx => chooseLang(ctx))

bot.action("choose lang", ctx => {
  ctx.deleteMessage(ctx.callbackQuery.message.message_id)
  chooseLang(ctx)
})

bot.action(["lang uz", "lang ru"], async ctx => {
  const lang = ctx.match[0] === "lang ru" ? "ru" : "uz"
  selectRegion(ctx, lang)
  ctx.answerCbQuery()
  ctx.deleteMessage(ctx.callbackQuery.message.message_id)
})

bot.action(/region (.+)/, ctx => {
  const callbackQueryId = ctx.callbackQuery.id
  const data = ctx.match[1].split(",")
  const region = data[0]
  const lang = data[1]
  const provinces = regions[region]

  const keyBoard = buttons(provinces, "province", lang)

  keyBoard.push(backButton(`lang ${lang}`, lang))
  ctx.reply(botmsg[lang].choose_region, {
    reply_markup: {
      inline_keyboard: keyBoard,
    },
  })
  ctx.deleteMessage()
  bot.telegram.answerCbQuery(callbackQueryId)
})

bot.action(/province (.+)/, async ctx => {
  const data = ctx.match[1].split(",")
  const lang = data[1]
  const province = data[0]
  const callbackQueryId = ctx.callbackQuery.id
  const chatId = ctx.callbackQuery.from.id

  try {
    await ProfileModel.updateOne(
      { user_id: chatId },
      {
        lang: lang,
        region: province,
      },
      { upsert: true }
    )
  } catch (err) {
    bot.telegram.sendMessage(logChatId, JSON.stringify(err.message))
  }
  bot.telegram.answerCbQuery(
    callbackQueryId,
    botmsg[lang].region_saved + province
  )
  bot.telegram.deleteMessage(chatId, ctx.callbackQuery.message.message_id)
  sendCommands(chatId, lang)
})

bot.hears([botmsg.uz.week, botmsg.ru.week], async ctx => {
  const lang = ctx.match[0] === botmsg.uz.week ? "uz" : "ru"
  const chatId = ctx.message.from.id
  const { region } = await ProfileModel.findOne(
    { user_id: chatId },
    { _id: 0, lang: 0 }
  )
  let resData = await axios.get(
    "https://namozvaqti.herokuapp.com/api/present/week/",
    {
      params: {
        region,
      },
    }
  )
  resData = resData.data

  let date = resData[0].date

  let datas = [
    `
  ${botmsg[lang].respm.region}: ${resData[0].region}
  ${botmsg[lang].respm.date}: ${date.split(",")[0]}
  ${botmsg[lang].respm.tong}: ${resData[0].times.tong_saharlik}
  ${botmsg[lang].respm.quyosh}: ${resData[0].times.quyosh}
  ${botmsg[lang].respm.peshin}: ${resData[0].times.peshin}
  ${botmsg[lang].respm.asr}: ${resData[0].times.asr}
  ${botmsg[lang].respm.shom}: ${resData[0].times.shom_iftor}
  ${botmsg[lang].respm.hufton}: ${resData[0].times.hufton}
  `,
  ]

  for (let i = 1; i < resData.length; i++) {
    date = resData[i].date.split(",")[0]
    const data = `
  ${botmsg[lang].respm.tong}: ${resData[i].times.tong_saharlik}
  ${botmsg[lang].respm.quyosh}: ${resData[i].times.quyosh}
  ${botmsg[lang].respm.peshin}: ${resData[i].times.peshin}
  ${botmsg[lang].respm.asr}: ${resData[i].times.asr}
  ${botmsg[lang].respm.shom}: ${resData[i].times.shom_iftor}
  ${botmsg[lang].respm.hufton}: ${resData[i].times.hufton}
    `

    datas.push(data)
  }
  let resp = datas.join("\n")
  ctx.reply(resp)
})

bot.hears(["Sozlamalar", "Настройки"], ctx => {
  const lang = ctx.match[0] === "Sozlamalar" ? "uz" : "ru"
  ctx.reply(ctx.match[0], {
    reply_markup: {
      keyboard: [
        [
          { text: botmsg[lang].change_lang },
          { text: botmsg[lang].change_region },
        ],
        [{ text: botmsg[lang].go_home }],
      ],
    },
  })
})

bot.hears(["Hududni o'zgartirish 📍", "Изменить область 📍"], ctx => {
  const lang = ctx.match[0] === "Hududni o'zgartirish 📍" ? "uz" : "ru"
  selectRegion(ctx, lang, true)
  ctx.deleteMessage()
})

bot.action("Select region", ctx => {
  selectRegion(ctx)
  ctx.answerCbQuery()
})

bot.hears([botmsg.uz.go_home, botmsg.ru.go_home], ctx => {
  const lang = ctx.message.text === botmsg.uz.go_home ? "uz" : "ru"
  const chatId = ctx.message.chat.id
  sendCommands(chatId, lang)
})
bot.hears([botmsg.uz.today, botmsg.ru.today], async ctx => {
  const lang = ctx.match[0] === botmsg.uz.today ? "uz" : "ru"
  // const date = new Date()
  // const month = date.getMonth() + 1
  // const day = date.getDate()
  const chatId = ctx.message.chat.id
  const { region } = await ProfileModel.findOne(
    { user_id: chatId },
    { _id: 0, user_id: 0, lang: 0 }
  )
  const res = await axios.get(
    `https://namozvaqti.herokuapp.com/api/present/day`,
    {
      params: {
        region,
      },
    }
  )
  const resData = res.data
  const date = resData.date
  const resMessage = `
  ${botmsg[lang].respm.region}: ${resData.region}
  ${botmsg[lang].respm.date}: ${date}

  ${botmsg[lang].respm.tong}: ${resData.times.tong_saharlik}
  
  ${botmsg[lang].respm.quyosh}: ${resData.times.quyosh}
  
  ${botmsg[lang].respm.peshin}: ${resData.times.peshin}
  
  ${botmsg[lang].respm.asr}: ${resData.times.asr}
  
  ${botmsg[lang].respm.shom}: ${resData.times.shom_iftor}
  
  ${botmsg[lang].respm.hufton}: ${resData.times.hufton}
  
  `

  bot.telegram.sendMessage(chatId, resMessage, { parse_mode: "Markdown" })
})

bot.hears([botmsg.uz.change_lang, botmsg.ru.change_lang], ctx => {
  const lang = ctx.match[0] === botmsg.uz.change_lang ? "uz" : "ru"
  ctx.reply("Kerakli tilni tanlang: \n\nВыбрать язык:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Uzbek", callback_data: "clang uz" },
          { text: "Русский", callback_data: "clang ru" },
        ],
      ],
    },
  })
})

bot.action(["clang uz", "clang ru"], ctx => {
  const lang = "clang uz" === ctx.match[0] ? "uz" : "ru"
  const chatId = ctx.callbackQuery.from.id
  const callbackQueryId = ctx.callbackQuery.id
  ProfileModel.findOneAndUpdate({ user_id: chatId }, { $set: { lang: lang } })
  bot.telegram.answerCbQuery(callbackQueryId, botmsg[lang].lang_changed + lang)
  bot.telegram.deleteMessage(chatId, ctx.callbackQuery.message.message_id)
  sendCommands(chatId, lang)
})

bot.on("text", ctx => {
  bot.telegram.forwardMessage(
    logChatId,
    ctx.message.from.id,
    ctx.message.message_id
  )
})

function chooseLang(ctx) {
  ctx.reply("Kerakli tilni tanlang: \n\nВыбрать язык:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Uzbek", callback_data: "lang uz" },
          { text: "Русский", callback_data: "lang ru" },
        ],
      ],
    },
  })
}

function selectRegion(ctx, lang, backB) {
  //const chatId = ctx.callbackQuery.from.id

  const region = Object.keys(regions)
  const regionru = Object.keys(regionsru)
  const reg = [region, regionru]
  const keyBoard = buttons(reg, "region", lang)
  keyBoard[keyBoard.length - 1].push({
    text: lang === "ru" ? "Город Ташкент" : "Toshkent shaxri",
    callback_data: `province Toshkent,${lang}`,
  })
  if (!backB) keyBoard.push(backButton("choose lang", lang))

  ctx.reply(botmsg[lang].choose_region, {
    reply_markup: {
      inline_keyboard: keyBoard,
    },
  })
}

function buttons(region, alias, lang) {
  let sum = []

  let reg = lang === "uz" ? region[0] : region[1]
  region = region[0]
  let cbData = alias ?? "province"

  for (let i = 0; i < region.length; i += 2)
    region[i + 1]
      ? sum.push([
          { text: reg[i], callback_data: `${cbData} ${region[i]},${lang}` },
          {
            text: reg[i + 1],
            callback_data: `${cbData} ${region[i + 1]},${lang}`,
          },
        ])
      : sum.push([
          { text: reg[i], callback_data: `${cbData} ${region[i]},${lang}` },
        ])
  return sum
}
function sendCommands(chatId, lang) {
  bot.telegram.sendMessage(chatId, botmsg[lang].command, {
    reply_markup: {
      keyboard: [
        [{ text: botmsg[lang].today }, { text: botmsg[lang].week }],
        [{ text: botmsg[lang].settings }],
      ],
    },
  })
}

function backButton(place, lang) {
  return [{ text: botmsg[lang].go_back, callback_data: place }]
}

bot.telegram.setWebhook(tgboturl)
bot.startWebhook("/bot", null, 3000)
