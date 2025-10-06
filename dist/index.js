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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const TOKEN = process.env.BALE_BOT_TOKEN;
if (!TOKEN)
    throw new Error("توکن ربات در .env تعریف نشده!");
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;
const FILES_DIR = "/home/ubuntu-website/lab"; // مسیر فایل‌ها
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
const userStates = {};
// پیام‌های تکراری
const lastMessage = {};
app.post("/webhook", async (req, res) => {
    const message = req.body.message;
    if (!message?.chat?.id || !message.text)
        return res.sendStatus(400);
    const chatId = message.chat.id;
    const text = message.text.trim();
    if (lastMessage[chatId] === text)
        return res.sendStatus(200);
    lastMessage[chatId] = text;
    try {
        const state = userStates[chatId];
        if (text === "/start") {
            userStates[chatId] = { state: null };
            await axios_1.default.post(`${API_URL}/sendMessage`, {
                chat_id: chatId,
                text: "به ربات خوش آمدید 👋\nبرای دریافت جواب آزمایش خود روی 📝 دریافت آزمایش کلیک کنید.",
                reply_markup: {
                    keyboard: [[{ text: "📝 دریافت آزمایش" }]],
                    resize_keyboard: true,
                },
            });
        }
        else if (text === "📝 دریافت آزمایش") {
            userStates[chatId] = { state: "awaiting_national_id" };
            await axios_1.default.post(`${API_URL}/sendMessage`, {
                chatId,
                text: "لطفاً کد ملی خود را وارد کنید:",
            });
        }
        else if (state?.state === "awaiting_national_id") {
            const nationalId = text;
            const userDir = path_1.default.join(FILES_DIR, nationalId);
            if (!fs_1.default.existsSync(userDir)) {
                await axios_1.default.post(`${API_URL}/sendMessage`, { chatId, text: "فایلی برای این کد ملی پیدا نشد." });
                userStates[chatId] = { state: null };
                return res.sendStatus(200);
            }
            const files = fs_1.default.readdirSync(userDir).filter(f => f.endsWith(".pdf"));
            if (files.length === 0) {
                await axios_1.default.post(`${API_URL}/sendMessage`, { chatId, text: "هیچ فایل آزمایشی موجود نیست." });
                userStates[chatId] = { state: null };
                return res.sendStatus(200);
            }
            const buttons = files.map(f => [{ text: path_1.default.parse(f).name }]); // شماره فایل‌ها
            await axios_1.default.post(`${API_URL}/sendMessage`, {
                chatId,
                text: "لطفاً شماره آزمایش مورد نظر را انتخاب کنید:",
                reply_markup: { keyboard: buttons, resize_keyboard: true },
            });
            userStates[chatId] = { state: "awaiting_test_number", nationalId, files };
        }
        else if (state?.state === "awaiting_test_number") {
            const testNumber = text;
            const { nationalId, files } = state;
            const fileName = files?.find(f => path_1.default.parse(f).name === testNumber);
            if (!fileName) {
                await axios_1.default.post(`${API_URL}/sendMessage`, { chatId, text: "شماره آزمایش معتبر نیست." });
                return res.sendStatus(200);
            }
            const filePath = path_1.default.join(FILES_DIR, nationalId, fileName);
            const form = new form_data_1.default();
            form.append("chat_id", chatId);
            form.append("document", fs_1.default.createReadStream(filePath));
            form.append("caption", `آزمایش شماره ${testNumber} شما`);
            await axios_1.default.post(`${API_URL}/sendDocument`, form, { headers: form.getHeaders() });
            // بازگرداندن به حالت اولیه
            userStates[chatId] = { state: null };
        }
        else {
            await axios_1.default.post(`${API_URL}/sendMessage`, { chatId, text: "لطفاً گزینه موجود را انتخاب کنید." });
        }
    }
    catch (err) {
        console.error("خطا:", err.response?.data || err.message);
    }
    res.sendStatus(200);
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 سرور روی پورت ${PORT} اجرا شد`));
