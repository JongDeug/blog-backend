import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dirPath = path.join(__dirname, '../../uploads/');
        try {
            // I. 디렉토리 존재여부 확인
            fs.accessSync(dirPath);
        } catch (err) {
            // I. 디렉토리가 존재하지 않으면 생성
            fs.mkdirSync(dirPath, { recursive: true });
        }
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // I.Date.now() 충돌할 가능성 존재 => uuid 로 변경
        const fileuuid = uuidv4();
        const extension = file.originalname.split('.').pop();
        const uuidFilename = fileuuid + '.' + extension;
        cb(null, uuidFilename);
    },
});

export const upload = multer({ storage: storage });
