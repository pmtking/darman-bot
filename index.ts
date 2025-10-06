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

// پیام‌های دریافتی
interface BaleMessage {
  message?: {
    chat?: { id: number };
    text?: string;
  };
}

// برای جلوگیری از پردازش پیام‌های تکراری
const lastMessage: { [chatId: number]: string } = {};

app.post(
  "/webhook",
  async (req: Request<{}, {}, BaleMessage>, res: Response) => {
    const message = req.body.message;

    if (!message || !message.chat?.id || !message.text) {
      console.log("درخواست نامعتبر:", req.body);
      return res.sendStatus(400);
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    console.log(
      new Date().toISOString(),
      "پیام دریافتی:",
      text,
      "chatId:",
      chatId
    );

    // جلوگیری از پردازش پیام تکراری
    if (lastMessage[chatId] === text) {
      console.log("پیام تکراری، نادیده گرفته شد.");
      return res.sendStatus(200);
    }
    lastMessage[chatId] = text;

    try {
      if (text === "/start") {
        userStates[chatId] = null;
        console.log("ارسال پیام خوش‌آمدگویی به کاربر:", chatId);
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "به ربات خوش آمدید!",
          reply_markup: {
            keyboard: [
              [{ text: "📝 دریافت ازمایش" }, { text: "ℹ️ اطلاعات بیشتر" }],
              [{ text: "📞 تماس با ما" }],
            ],
            resize_keyboard: true,
          },
        });
      } else if (text === "📝 دریافت ازمایش") {
        userStates[chatId] = "awaiting_national_id";
        console.log("درخواست دریافت آزمایش از کاربر:", chatId);
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "لطفا کد ملی خود را وارد کنید:",
        });
      } else if (userStates[chatId] === "awaiting_national_id") {
        const nationalId = text;
        console.log("دریافت کد ملی:", nationalId, "از کاربر:", chatId);

        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: `در حال بررسی فایل آزمایش برای کد ملی ${nationalId}...`,
        });

        const filePath = path.join(
          "/home/ubuntu-website/darmanBot/",
          `${nationalId}.pdf`
        );
        console.log("مسیر فایل بررسی شده:", filePath);

        if (!fs.existsSync(filePath)) {
          console.log("فایل پیدا نشد!");
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: `فایل آزمایش برای کد ملی ${nationalId} یافت نشد.`,
          });
        } else {
          console.log("فایل پیدا شد، ارسال به کاربر...");
          const form = new FormData();
          form.append("chat_id", chatId);
          form.append("document", fs.createReadStream(filePath));
          form.append("caption", `فایل آزمایش شما (کد ملی: ${nationalId})`);

          await axios.post(`${API_URL}/sendDocument`, form, {
            headers: form.getHeaders(),
          });
        }

        // بازنشانی وضعیت کاربر
        userStates[chatId] = null;
      } else {
        console.log("پیام معمولی از کاربر:", text);
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: `شما گفتید: ${text}`,
        });
      }
    } catch (err: any) {
      console.error("خطا در ارسال پاسخ:", err.response?.data || err.message);
    }

    res.sendStatus(200);
  }
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`سرور اجرا شد روی پورت ${PORT}`);
});
