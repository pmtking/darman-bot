import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import path from "path";

const TOKEN = "2110122142:9IBKnThv3eNh3KmCc2pcOxDiMFe7w9bSCQaeTXGb";
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;

const app = express();
app.use(bodyParser.json());

// وضعیت کاربران
interface UserStates {
  [chatId: number]: "awaiting_national_id" | null;
}
const userStates: UserStates = {};

// پیام‌های تکراری
const lastMessage: { [chatId: number]: string } = {};

// نوع پیام بله
interface BaleMessage {
  message?: {
    chat?: { id: number };
    text?: string;
  };
}

// دریافت IP عمومی سرور
async function getPublicIP(): Promise<string> {
  try {
    const res = await axios.get("https://ifconfig.me/ip");
    return res.data.trim();
  } catch (err) {
    console.error("❌ خطا در دریافت IP عمومی:", err);
    return "IP پیدا نشد";
  }
}

// Webhook
app.post("/webhook", async (req: Request<{}, {}, BaleMessage>, res: Response) => {
  const message = req.body.message;

  if (!message?.chat?.id || !message.text) {
    console.log("درخواست نامعتبر:", req.body);
    return res.sendStatus(400);
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  console.log(new Date().toISOString(), "پیام دریافتی:", text, "chatId:", chatId);

  // جلوگیری از پیام تکراری
  if (lastMessage[chatId] === text) {
    console.log("پیام تکراری، نادیده گرفته شد.");
    return res.sendStatus(200);
  }
  lastMessage[chatId] = text;

  try {
    if (text === "/start") {
      userStates[chatId] = null;
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

      const filePath = path.join("/home/ubuntu-website/darmanBot/", `${nationalId}.pdf`);
      console.log("مسیر فایل بررسی شده:", filePath);

      if (!fs.existsSync(filePath)) {
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: `فایل آزمایش برای کد ملی ${nationalId} یافت نشد.`,
        });
      } else {
        const form = new FormData();
        form.append("chat_id", chatId);
        form.append("document", fs.createReadStream(filePath));
        form.append("caption", `فایل آزمایش شما (کد ملی: ${nationalId})`);

        await axios.post(`${API_URL}/sendDocument`, form, {
          headers: form.getHeaders(),
        });
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

// Endpoint نمایش IP عمومی سرور
app.get("/my-ip", async (_req, res) => {
  const ip = await getPublicIP();
  res.send({ publicIP: ip });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  const ip = await getPublicIP();
  console.log(`🚀 سرور اجرا شد روی پورت ${PORT}`);
  console.log(`🌐 IP عمومی سرور: ${ip}`);
  console.log(`📡 آدرس webhook: http://${ip}:${PORT}/webhook`);
});
