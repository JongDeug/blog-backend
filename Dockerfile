# [Multi-Stage builds]
# 해당 빌드는 linux/amd64 를 사용함
# 하지만 라즈베리파이는 linux/arm64 를 사용함
# 라즈베리파이에서 QEMU 를 다운로드 후 에뮬레이터로 돌려야함
# ----------------------------------- Builder ----------------------------------- #
FROM node:22-alpine AS builder

# 존재하지 않을 경우 생성
WORKDIR /app/blog-backend-app

# 프로젝트 복사 (dockerignore 참고)
COPY . .

# yarn berry 설정
RUN yarn set version berry
# yarn.lock package.json 일관성 유지 및 빌드
RUN yarn install --immutable && yarn build
# devDependencies 제외하기 위해 삭제
RUN rm -rf ./.yarn/cache ./.yarn/unplugged

ENV NODE_ENV=production
RUN yarn install --immutable

# ----------------------------------- Runner ----------------------------------- #
FROM node:22-alpine AS runner

WORKDIR /app/blog-backend-app

# 원하는 파일 복사
COPY --from=builder /app/blog-backend-app/.pnp.cjs                  ./.pnp.cjs
COPY --from=builder /app/blog-backend-app/.env                      ./.env
COPY --from=builder /app/blog-backend-app/.yarnrc.yml               ./.yarnrc.yml
COPY --from=builder /app/blog-backend-app/.yarn                     ./.yarn
COPY --from=builder /app/blog-backend-app/yarn.lock                 ./yarn.lock
COPY --from=builder /app/blog-backend-app/package.json              ./package.json
COPY --from=builder /app/blog-backend-app/tsconfig.json             ./tsconfig.json
COPY --from=builder /app/blog-backend-app/swagger.yaml              ./swagger.yaml
COPY --from=builder /app/blog-backend-app/dist                      ./dist
COPY --from=builder /app/blog-backend-app/prisma                    ./prisma

# 컨테이너가 사용할 포트
EXPOSE 8080

# 컨테이너가 만들어지고 사용할 명령어
CMD ["yarn", "start:prod"]
