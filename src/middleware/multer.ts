import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dirPath = path.join(__dirname, '../../uploads');
        try {
            // 디렉토리 존재여부 확인
            fs.accessSync(dirPath);
        } catch (err) {
            // 디렉토리가 존재하지 않으면 생성
            fs.mkdirSync(dirPath, { recursive: true });
        }
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // I. 같은 시간에 생성되는 이미도 있어서 Math.random 까지 추가함
        cb(null, `${Date.now()}${Math.random()}-${file.originalname}`);
    },
});

export const upload = multer({ storage: storage });
