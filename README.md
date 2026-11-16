This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## หน้าร้านค้า

เปิด `/vendor` แล้วใช้ค่า `VENDOR_PASSWORD` ในไฟล์ `.env` เพื่อเข้าสู่ระบบร้านค้า รหัสผ่านต้องมีอย่างน้อย 16 ตัวอักษร ควรใช้รหัสสุ่มที่คาดเดายากและเก็บเป็นความลับ ถ้าเปลี่ยนค่าใน `.env` ให้ปิดและเริ่มเซิร์ฟเวอร์ใหม่ การเปลี่ยนรหัสจะทำให้เซสชันเดิมใช้ไม่ได้

เมื่อนำขึ้น Vercel ต้องตั้ง `VENDOR_PASSWORD` ใน Environment Variables ของโปรเจกต์ด้วย โดยใช้รหัสสุ่มที่แตกต่างจากในเครื่อง หน้าร้านค้าจะปิดการเข้าถึงถ้ายังไม่ได้กำหนดรหัสที่ยาวพอ ระบบเข้าสู่ระบบนี้เป็นแบบง่ายสำหรับต้นแบบ ยังไม่มีระบบจัดการบัญชีหรือจำกัดจำนวนครั้งที่ลองรหัส จึงควรเพิ่มระบบยืนยันตัวตนที่เหมาะสมก่อนใช้จริง

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
