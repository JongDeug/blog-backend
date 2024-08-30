import { deleteImage } from '@utils/filesystem';

export const redisListener = async (key: string) => {
    // I. 이미지 만료 관리
    if (key.startsWith('image')) {
        const imagePath = key.split(':').pop();
        if (imagePath) deleteImage(imagePath);
    }
};
