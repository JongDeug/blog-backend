import { Injectable } from '@nestjs/common';

@Injectable()
export class CommonService {
  // 커서를 디코드해서 반환하는 함수
  decodeCursor(cursor: string | undefined): {
    values: { id: number };
    order: string[];
  } | null {
    if (cursor) {
      const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
      /**
       * {
       *  values: {
       *   id: 27,
       *  },
       *  order: ['id_desc'],
       * }
       */
      return JSON.parse(decodedCursor);
    }
  }

  parseOrder(order: string[]): {} {
    return Object.fromEntries(
      order.map((item) => {
        return item.split('_');
      }),
    );
  }

  // 커서를 생성하는 함수
  generateNextCursor<T>(results: T[], order: string[]): string | null {
    if (!results.length) return null;
    /**
     * {
     *  values : {
     *   id: 27
     *  },
     *  order: ["id_DESC"]
     * }
     */

    const lastItem = results[results.length - 1];

    // values 만들기
    const values = {};
    order.forEach((item) => {
      const [key, _] = item.split('_');
      values[key] = lastItem[key];
    });

    const nextCursor = { values, order };
    const base64 = Buffer.from(JSON.stringify(nextCursor)).toString('base64');

    return base64;
  }
}
