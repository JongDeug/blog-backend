import { Test, TestingModule } from '@nestjs/testing';
import { CommonController } from './common.controller';

describe('CommonController', () => {
  let commonController: CommonController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommonController],
    }).compile();

    commonController = module.get<CommonController>(CommonController);
  });

  it('should be defined', () => {
    expect(commonController).toBeDefined();
  });

  // given
  // when
  // then

  describe('createImage', () => {
    it('should create a image', () => {
      const image = { filename: 'testImage' } as Express.Multer.File;

      const result = commonController.createImage(image);

      expect(result).toEqual({ filename: image.filename });
    });
  });
});
