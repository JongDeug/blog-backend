import nodemailer from 'nodemailer';

console.log(process.env.MAIL_ID);
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_ID, // 본인의 이메일 주소
        pass: process.env.MAIL_PWD,   // 본인의 이메일 비밀번호
    },
});

export default transporter;
