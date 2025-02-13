import { Test, TestingModule } from '@nestjs/testing';
import { CommonController } from './common.controller';
import { mock } from 'jest-mock-extended';
import { RssService } from './rss.service';

describe('CommonController', () => {
  let commonController: CommonController;
  // let rssService: MockProxy<RssService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommonController],
      providers: [{ provide: RssService, useValue: mock<RssService>() }],
    }).compile();

    commonController = module.get<CommonController>(CommonController);
    // rssService = module.get(RssService);
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
