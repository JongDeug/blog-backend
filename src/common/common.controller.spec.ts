import { Test, TestingModule } from '@nestjs/testing';
import { CommonController } from './common.controller';
import { mock } from 'jest-mock-extended';
import { CommonService } from './common.service';

describe('CommonController', () => {
  let commonController: CommonController;
  // let commonService: MockProxy<CommonService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommonController],
      providers: [{ provide: CommonService, useValue: mock<CommonService>() }],
    }).compile();

    commonController = module.get<CommonController>(CommonController);
    // commonService = module.get(CommonService);
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
