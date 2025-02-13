import { Injectable } from '@nestjs/common';
import Parser from 'rss-parser';

@Injectable()
export class CommonService {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }
  async getFeed(url: string) {
    const feed = await this.parser.parseURL(url);
    const posts = feed.items.map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      source: feed.title, // RSS 출처 표시
    }));
    return posts;
  }
}
