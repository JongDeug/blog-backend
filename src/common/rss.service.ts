import { Injectable } from '@nestjs/common';
import Parser from 'rss-parser';

@Injectable()
export class RssService extends Parser {
  private subscriptions: { url: string; name: string }[];

  constructor() {
    super();

    this.subscriptions = [
      {
        name: '인프런',
        url: 'https://tech.inflab.com/rss.xml',
      },
      {
        name: 'GeekNews',
        url: 'https://feeds.feedburner.com/geeknews-feed',
      },
      {
        name: '원티드',
        url: 'https://medium.com/feed/wantedjobs',
      },
      {
        name: '당근',
        url: 'https://medium.com/feed/daangn',
      },
      {
        name: '무신사',
        url: 'https://medium.com/feed/musinsa-tech',
      },
      {
        name: '카카오',
        url: 'https://tech.kakao.com/feed/',
      },
      {
        name: '토스',
        url: 'https://toss.tech/rss.xml',
      },
      {
        name: '직방',
        url: 'https://medium.com/feed/zigbang',
      },
      {
        name: '소카',
        url: 'https://tech.socarcorp.kr/feed',
      },
      {
        name: '여기어때',
        url: 'https://techblog.gccompany.co.kr/feed',
      },
    ];
  }
  async getFeed(url: string) {
    const feed = await this.parseURL(url);

    return feed.items.map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      source: feed.title, // RSS 출처 표시
    }));
  }

  getSubscriptions() {
    return this.subscriptions;
  }
}
