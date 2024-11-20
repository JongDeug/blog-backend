import { Prisma } from '@prisma/client';

export type FoundParentComment = Prisma.CommentGetPayload<{
  include: {
    post: { include: { author: true } };
    childComments: { include: { author: true; guest: true } };
    author: true;
    guest: true;
  };
}>;
