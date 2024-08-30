import fs from 'fs';
import path from 'path';
import { Image } from '../../prisma/prisma-client';

const filepath = path.join(__dirname, '../../');

export const deleteImage = (imagePath: string) => {
    try {
        fs.unlinkSync(`${filepath}/${imagePath}`);
    } catch (err) {
        console.error(err);
    }
};

export const deleteImages = async (images: Image[]) => {
    return Promise.all(
        images.map(
            (file) =>
                new Promise((resolve, reject) => {
                    try {
                        fs.unlinkSync(`${filepath}/${file.url}`);
                        resolve(`${file.url} 파일이 성공적으로 삭제됨`);
                    } catch (err) {
                        reject(err);
                    }
                }),
        ),
    );
};
