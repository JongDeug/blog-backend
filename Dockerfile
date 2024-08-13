# Multi-Stage builds
# ----------------------------------- Builder ----------------------------------- #
# arm64 => 라즈베리파이
FROM --platform=linux/arm64 node:22-alpine AS builder

# 존재하지 않을 경우 생성
WORKDIR /usr/blog-backend-app

# 프로젝트 복사
COPY .pnp.cjs .yarnrc.yml yarn.lock package.json tsconfig.json .env     /usr/blog-backend-app/
COPY ./.yarn/releases                                                   /usr/blog-backend-app/.yarn/releases
COPY ./.yarn/sdks                                                       /usr/blog-backend-app/.yarn/sdks
COPY prisma                                                             /usr/blog-backend-app/prisma
COPY src                                                                /usr/blog-backend-app/src

# yarn berry 설정
RUN yarn set version berry
# yarn.lock package.json 일관성 유지 및 빌드
RUN yarn install --immutable && yarn build

# ----------------------------------- Runner ----------------------------------- #
FROM --platform=linux/arm64 node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# 최적화
COPY --from=builder /usr/blog-backend-app/.pnp.cjs                  /app/.pnp.cjs
COPY --from=builder /usr/blog-backend-app/.env                      /app/.env
COPY --from=builder /usr/blog-backend-app/.yarnrc.yml               /app/.yarnrc.yml
COPY --from=builder /usr/blog-backend-app/yarn.lock                 /app/yarn.lock
COPY --from=builder /usr/blog-backend-app/package.json              /app/package.json
COPY --from=builder /usr/blog-backend-app/tsconfig.json             /app/tsconfig.json
COPY --from=builder /usr/blog-backend-app/dist                      /app/dist
COPY --from=builder /usr/blog-backend-app/prisma                    /app/prisma
COPY --from=builder /usr/blog-backend-app/src/swagger               /app/dist/swagger

# 캐시 삭제 후 이동
RUN rm -rf ./.yarn/cache ./.yarn/unplugged
COPY --from=builder /usr/blog-backend-app/.yarn                     /app/.yarn

# Docker 컨테이너가 사용할 포트
EXPOSE 8080

CMD ["yarn", "start:prod"]
