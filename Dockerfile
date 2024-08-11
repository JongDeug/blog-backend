# Multi-Stage builds
# ----------------------------------- Builder ----------------------------------- #
FROM node:22-bullseye-slim AS builder

# 존재하지 않을 경우 생성
WORKDIR /usr/blog-backend-app

# 프로젝트 복사
COPY . .

# yarn berry 설정
RUN yarn set version berry
# yarn.lock package.json 일관성 유지
RUN yarn install --immutable && yarn build

# ----------------------------------- Runner ----------------------------------- #
FROM node:22-bullseye-slim AS runner

WORKDIR /usr/blog-backend-app

ENV NODE_ENV=production

# 최적화
COPY --from=builder /usr/blog-backend-app/.yarn/                    ./.yarn
COPY --from=builder /usr/blog-backend-app/.pnp.cjs                  ./
COPY --from=builder /usr/blog-backend-app/.yarnrc.yml               ./
COPY --from=builder /usr/blog-backend-app/yarn.lock                 ./
COPY --from=builder /usr/blog-backend-app/package.json              ./
COPY --from=builder /usr/blog-backend-app/tsconfig.json              ./
COPY --from=builder /usr/blog-backend-app/dist                      ./dist
COPY --from=builder /usr/blog-backend-app/prisma                    ./prisma
#COPY --from=builder /usr/blog-backend-app/src/swagger               ./dist/src/swagger

# Note yarn rebuild again - this is to let yarn rebuild binaries in the "runner" stage of the Dockerfile
# We also have to remove unplugged, so that rebuilding happens and replaces the old binaries
RUN rm -rf /usr/blog-backend-app/.yarn/unplugged && yarn rebuild

# 컨테이너가 사용할 포트
EXPOSE 8080

CMD ["yarn", "start:prod"]
