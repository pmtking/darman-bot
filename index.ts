import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.BALE_BOT_TOKEN;
if (!TOKEN) throw new Error("توکن ربات در .env تعریف نشده!");
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;

const FILES_DIR = "/home/ubuntu-website/lab"; // مسیر فایل‌ها

const app = express();
app.use(bodyParser.json());

// وضعیت کاربران
interface UserStates {
  [chatId: number]: { state: "awaiting_national_id" | "awaiting_test_number" | null; nationalId?: string; files?: string[] };
}
const userStates: UserStates = {};

// پیام‌های تکراری
const lastMessage: { [chatId: number]: string } = {};

app.post("/webhook", async (req: Request<{}, {}, any>, res: Response) => {
  const message = req.body.message;
  if (!message?.chat?.id || !message.text) return res.sendStatus(400);

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (lastMessage[chatId] === text) return res.sendStatus(200);
  lastMessage[chatId] = text;

  try {
    const state = userStates[chatId];

    if (text === "/start") {
      userStates[chatId] = { state: null };
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: "به ربات خوش آمدید 👋\nبرای دریافت جواب آزمایش خود روی 📝 دریافت آزمایش کلیک کنید.",
        reply_markup: {
          keyboard: [[{ text: "📝 دریافت آزمایش" }]],
          resize_keyboard: true,
        },
      });
    } else if (text === "📝 دریافت آزمایش") {
      userStates[chatId] = { state: "awaiting_national_id" };
      await axios.post(`${API_URL}/sendMessage`, {
        chatId,
        text: "لطفاً کد ملی خود را وارد کنید:",
      });
    } else if (state?.state === "awaiting_national_id") {
      const nationalId = text;
      const userDir = path.join(FILES_DIR, nationalId);
      if (!fs.existsSync(userDir)) {
        await axios.post(`${API_URL}/sendMessage`, { chatId, text: "فایلی برای این کد ملی پیدا نشد." });
        userStates[chatId] = { state: null };
        return res.sendStatus(200);
      }

      const files = fs.readdirSync(userDir).filter(f => f.endsWith(".pdf"));
      if (files.length === 0) {
        await axios.post(`${API_URL}/sendMessage`, { chatId, text: "هیچ فایل آزمایشی موجود نیست." });
        userStates[chatId] = { state: null };
        return res.sendStatus(200);
      }

      const buttons = files.map(f => [{ text: path.parse(f).name }]); // شماره فایل‌ها
      await axios.post(`${API_URL}/sendMessage`, {
        chatId,
        text: "لطفاً شماره آزمایش مورد نظر را انتخاب کنید:",
        reply_markup: { keyboard: buttons, resize_keyboard: true },
      });

      userStates[chatId] = { state: "awaiting_test_number", nationalId, files };
    } else if (state?.state === "awaiting_test_number") {
      const testNumber = text;
      const { nationalId, files } = state;
      const fileName = files?.find(f => path.parse(f).name === testNumber);

      if (!fileName) {
        await axios.post(`${API_URL}/sendMessage`, { chatId, text: "شماره آزمایش معتبر نیست." });
        return res.sendStatus(200);
      }

      const filePath = path.join(FILES_DIR, nationalId!, fileName);
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("document", fs.createReadStream(filePath));
      form.append("caption", `آزمایش شماره ${testNumber} شما`);

      await axios.post(`${API_URL}/sendDocument`, form, { headers: form.getHeaders() });

      // بازگرداندن به حالت اولیه
      userStates[chatId] = { state: null };
    } else {
      await axios.post(`${API_URL}/sendMessage`, { chatId, text: "لطفاً گزینه موجود را انتخاب کنید." });
    }
  } catch (err: any) {
    console.error("خطا:", err.response?.data || err.message);
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 سرور روی پورت ${PORT} اجرا شد`));
