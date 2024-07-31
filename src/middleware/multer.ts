import multer from 'multer';

// Multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // I. 같은 시간에 생성되는 이미도 있어서 Math.random 까지 추가함
        cb(null, `${Date.now()}${Math.random()}-${file.originalname}`);
    },
});

export const upload = multer({ storage: storage });
