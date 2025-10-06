import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import path from "path";

// ⚠️ بله Token
const TOKEN = "2110122142:9IBKnThv3KmCc2pcOxDiMFe7w9bSCQaeTXGb";
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;

// ⚠️ دامنه واقعی با HTTPS فعال
const DOMAIN = "bot.df-neyshabor.ir";

// مسیر فایل‌ها
const FILES_DIR = "/home/ubuntu-website/darmanBot";

const app = express();
app.use(bodyParser.json());

// وضعیت کاربران
interface UserStates {
  [chatId: number]: "awaiting_national_id" | null;
}
const userStates: UserStates = {};

// پیام‌های تکراری
const lastMessage: { [chatId: number]: string } = {};

// Webhook بله
app.post("/webhook", async (req: Request<{}, {}, any>, res: Response) => {
  const message = req.body.message;
  if (!message?.chat?.id || !message.text) return res.sendStatus(400);

  const chatId = message.chat.id;
  const text = message.text.trim();

  // جلوگیری از پیام تکراری
  if (lastMessage[chatId] === text) return res.sendStatus(200);
  lastMessage[chatId] = text;

  try {
    if (text === "/start") {
      userStates[chatId] = null;
      console.log(`کاربر ${chatId} شروع کرد.`);
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: "به ربات خوش آمدید 👋",
        reply_markup: {
          keyboard: [
            [{ text: "📝 دریافت آزمایش" }, { text: "ℹ️ اطلاعات بیشتر" }],
            [{ text: "📞 تماس با ما" }],
          ],
          resize_keyboard: true,
        },
      });
    } else if (text === "📝 دریافت آزمایش") {
      userStates[chatId] = "awaiting_national_id";
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: "لطفاً کد ملی خود را وارد کنید:",
      });
    } else if (userStates[chatId] === "awaiting_national_id") {
      const nationalId = text;
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: `در حال بررسی فایل آزمایش برای کد ملی ${nationalId}...`,
      });

      const filePath = path.join(FILES_DIR, `${nationalId}.pdf`);
      console.log("بررسی فایل:", filePath);

      if (!fs.existsSync(filePath)) {
        console.log("فایل پیدا نشد:", filePath);
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: `فایل آزمایش برای کد ملی ${nationalId} یافت نشد.`,
        });
      } else {
        console.log("ارسال فایل به کاربر:", chatId);
        const form = new FormData();
        form.append("chat_id", chatId);
        form.append("document", fs.createReadStream(filePath));
        form.append("caption", `فایل آزمایش شما (کد ملی: ${nationalId})`);

        await axios.post(`${API_URL}/sendDocument`, form, { headers: form.getHeaders() });
      }

      userStates[chatId] = null;
    } else {
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: `شما گفتید: ${text}`,
      });
    }
  } catch (err: any) {
    console.error("خطا در ارسال پاسخ:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// ثبت خودکار webhook
async function setWebhook() {
  const url = `https://${DOMAIN}/webhook`;
  try {
    const res = await axios.post(`${API_URL}/setWebhook`, { url });
    console.log("✅ Webhook ثبت شد:", url, res.data);
  } catch (err: any) {
    console.error("❌ خطا در ثبت webhook:", err.response?.data || err.message);
  }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`🚀 سرور اجرا شد روی پورت ${PORT}`);
  await setWebhook();
});
