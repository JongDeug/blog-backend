import fs from 'fs';
import path from 'path';
import { Image } from '../../prisma/prisma-client';

const dirPath = path.join(__dirname, '../../');

export const deleteImage = (imagePath: string) => {
    try {
        fs.unlinkSync(`${dirPath}/${imagePath}`);
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
                        const url = file.url;
                        const splitUrl = url.split('/uploads')[1];
                        const imagePath = 'uploads' + splitUrl;
                        fs.unlinkSync(`${dirPath}/${imagePath}`);
                        resolve(`${file.url} 파일이 성공적으로 삭제됨`);
                    } catch (err) {
                        reject(err);
                    }
                }),
        ),
    );
};
