# [Multi-Stage builds]
# 해당 빌드는 linux/amd64를 사용
# 라즈베리파이는 linux/arm64를 사용하기 때문에 호환되지 않음
# 배포 또는 라즈베리파이에서 QEMU 다운 후 에뮬레이터로 실행시켜야 함
# ----------------------------------- Builder ----------------------------------- #
FROM node:22-alpine AS builder

# 존재하지 않을 경우 생성
WORKDIR /app

# pnpm 설치
RUN npm install -g pnpm

# 프로젝트 복사 (dockerignore 참고)
COPY . .

# pnpm 의존성 설치 및 빌드
RUN pnpm install --frozen-lockfile  

# Prisma 클라이언트 생성
RUN npx prisma generate 

# 애플리케이션 빌드
RUN pnpm build  

# devDependencies 제거 (프로덕션 의존성만 유지)
RUN pnpm prune --prod

# ----------------------------------- Runner ----------------------------------- #
FROM node:22-alpine AS runner

# 프로덕션 환경
ENV NODE_ENV=production

WORKDIR /app

# pnpm 설치
RUN npm install -g pnpm

# 필요한 파일 복사 (package.json > 명령어 실행해야 함)
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/.env /app/.env
COPY --from=builder /app/package.json /app/package.json

# 폴더 생성, 있어도 오류 X
RUN mkdir -p /app/uploads

# 애플리케이션 실행
CMD ["pnpm", "start:prod"]

EXPOSE 8080
