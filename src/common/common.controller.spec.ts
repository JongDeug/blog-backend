import { Test, TestingModule } from '@nestjs/testing';
import { CommonController } from './common.controller';
import { mock, MockProxy } from 'jest-mock-extended';
import { RssService } from './rss.service';

describe('CommonController', () => {
  let commonController: CommonController;
  let rssService: MockProxy<RssService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommonController],
      providers: [{ provide: RssService, useValue: mock<RssService>() }],
    }).compile();

    commonController = module.get<CommonController>(CommonController);
    rssService = module.get(RssService);
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

  describe('getRssFeed', () => {
    it('should return RSS feed data', async () => {
      const url = 'https://example.com/rss';
      const mockFeed = [
        {
          title: 'Test Feed',
          link: 'link',
          pubDate: 'pubDate',
          source: 'source',
        },
      ];
      jest.spyOn(rssService, 'getFeed').mockResolvedValue(mockFeed);

      const result = await commonController.getRssFeed(url);

      expect(result).toEqual(mockFeed);
      expect(rssService.getFeed).toHaveBeenCalledWith(url);
    });
  });

  describe('getSubscriptions', () => {
    it('should return subscription list', () => {
      const mockSubscriptions = [
        { url: 'https://example.com/rss1', name: 'rss1' },
        { url: 'https://example.com/rss2', name: 'rss2' },
      ];
      jest
        .spyOn(rssService, 'getSubscriptions')
        .mockReturnValue(mockSubscriptions);

      expect(commonController.getSubscriptions()).toEqual(mockSubscriptions);
      expect(rssService.getSubscriptions).toHaveBeenCalled();
    });
  });
});
