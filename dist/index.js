"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const form_data_1 = __importDefault(require("form-data"));
const path_1 = __importDefault(require("path"));
const TOKEN = "2110122142:9IBKnThv3eNh3KmCc2pcOxDiMFe7w9bSCQaeTXGb";
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
const userStates = {};
// برای جلوگیری از پردازش پیام‌های تکراری
const lastMessage = {};
app.post("/webhook", async (req, res) => {
    const message = req.body.message;
    if (!message || !message.chat?.id || !message.text) {
        console.log("درخواست نامعتبر:", req.body);
        return res.sendStatus(400);
    }
    const chatId = message.chat.id;
    const text = message.text.trim();
    console.log(new Date().toISOString(), "پیام دریافتی:", text, "chatId:", chatId);
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
            await axios_1.default.post(`${API_URL}/sendMessage`, {
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
        }
        else if (text === "📝 دریافت ازمایش") {
            userStates[chatId] = "awaiting_national_id";
            console.log("درخواست دریافت آزمایش از کاربر:", chatId);
            await axios_1.default.post(`${API_URL}/sendMessage`, {
                chat_id: chatId,
                text: "لطفا کد ملی خود را وارد کنید:",
            });
        }
        else if (userStates[chatId] === "awaiting_national_id") {
            const nationalId = text;
            console.log("دریافت کد ملی:", nationalId, "از کاربر:", chatId);
            await axios_1.default.post(`${API_URL}/sendMessage`, {
                chat_id: chatId,
                text: `در حال بررسی فایل آزمایش برای کد ملی ${nationalId}...`,
            });
            const filePath = path_1.default.join("/home/ubuntu-website/darmanBot/", `${nationalId}.pdf`);
            console.log("مسیر فایل بررسی شده:", filePath);
            if (!fs_1.default.existsSync(filePath)) {
                console.log("فایل پیدا نشد!");
                await axios_1.default.post(`${API_URL}/sendMessage`, {
                    chat_id: chatId,
                    text: `فایل آزمایش برای کد ملی ${nationalId} یافت نشد.`,
                });
            }
            else {
                console.log("فایل پیدا شد، ارسال به کاربر...");
                const form = new form_data_1.default();
                form.append("chat_id", chatId);
                form.append("document", fs_1.default.createReadStream(filePath));
                form.append("caption", `فایل آزمایش شما (کد ملی: ${nationalId})`);
                await axios_1.default.post(`${API_URL}/sendDocument`, form, {
                    headers: form.getHeaders(),
                });
            }
            // بازنشانی وضعیت کاربر
            userStates[chatId] = null;
        }
        else {
            console.log("پیام معمولی از کاربر:", text);
            await axios_1.default.post(`${API_URL}/sendMessage`, {
                chat_id: chatId,
                text: `شما گفتید: ${text}`,
            });
        }
    }
    catch (err) {
        console.error("خطا در ارسال پاسخ:", err.response?.data || err.message);
    }
    res.sendStatus(200);
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`سرور اجرا شد روی پورت ${PORT}`);
});
