# 🌐 blog-backend

## 📌 프로젝트 소개

기간: (2024.06 ~ .)

### 계기

단순히 설계와 구현에만 집중하고 있었다는 사실을 깨닫고, 지속적으로 운영 및 유지 보수할 수 있는 프로젝트의 필요성을 느꼈습니다. 블로그 프로젝트는 제 서비스 운영 경험의 첫 걸음입니다.

### 목표

1. 실제 서비스 운영에서 겪을 수 있는 문제들을 직접 경험해보고 해결할 수 있도록 합니다.
2. 지속적으로 코드 품질 개선합니다

## 📌 링크

#### 프로젝트 배포 주소

https://jongdeug.port0.org/

#### Trouble Shooting 기록

https://github.com/users/JongDeug/projects/9/views/3

#### 기능 개발 기록

https://github.com/users/JongDeug/projects/9/views/1

#### Swagger 배포 주소

https://jongdeug.port0.org/api/docs

## 📌 기술 스택

### v2

[![Nest.js](https://img.shields.io/badge/Nest.js-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Docker Compose](https://img.shields.io/badge/Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docs.docker.com/compose/)

### v1

[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Docker Compose](https://img.shields.io/badge/Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docs.docker.com/compose/)

### 기술 선택 이유

- **Express**: 학부 때 Express를 사용한 경험이 있어 비교적 빠른 API 개발 가능
- **NestJS**: Express는 자유도가 높아서 구조를 직접 설계해야 함. 반면 NestJS는 모듈화된 방식으로 설계를 유도하므로 코드를 좀 더 깔끔하게 작성할 수 있을거라 판단함
- **Javascript**: 하나의 언어로 프론트엔드, 백엔드 모두 개발 가능
- **Typescript**: 코드의 안전성과 유지 보수 향상
- **Prisma**: 스키마 작성이 TypeORM보다 직관적이며, 데이터베이스 관리 및 쿼리를 간편하게 수행
- **MySQL**: 관계형 데이터베이스 테이블 설계 경험을 쌓기 위해 선택
- **Swagger**: 학부 팀 프로젝트에서 명확한 소통의 필요성을 느껴 API 문서화 적용

## 📌 아키텍처

#### 전체적인 서비스 구조

![image](https://github.com/user-attachments/assets/310ff036-2fc6-4af0-9ae2-34d85788a736)

[//]: # '## 📌 기타 추가 사항들'
[//]: # '## 📌 화면 구성/API 주소'

## 📌 기능 개선

### 1. 사용자 인증 시스템

#### 문제

JWT를 이용한 사용자 인증 시스템에서 여러 이슈 발생:

- Refresh Token을 서버 DB에 저장하는 이유
- JWT 토큰을 클라이언트에게 안전하게 전달하기 위한 보안 이슈 해결

#### 해결

**1. 토큰 무효화**

- 초기 구현: 서버 DB에 Refresh Token 저장 → 해킹된 토큰을 무효화 가능
- 개선: 캐시를 활용해 DB 접근없이 토큰 무효화 가능하도록 변경 → 성능 최적화.

**2. 토큰 캐싱**

- 초기 구현: 요청마다 토큰 검증
- 개선: Access Token을 캐싱해 검증된 유저 응답 시간 단축

**3. 토큰 전송 방식**

- 쿠키에 HttpOnly, SameSite, Secure 속성을 적용해 안전하게 전달.

#### 성과

**1. 토큰 무효화**

- 탈취 위험에 대비 가능.

**2. 성능 개선**

- Access Token이 필요한 API 응답 시간 **37ms → 7ms (약 81% 단축)**
- Refresh API 응답 시간: **95ms → 73ms (약 23% 단축)**
- Logout API 응답 시간: **90ms → 57ms (약 36% 단축)**

**3. 보안 강화**

- XSS, CSRF, Sniffing 공격 방어 가능.

## 📌 설계 명세서

### ⚡ API 명세서

| 구분           | 기능명                  | HTTP Method | REST API                                   | JWT | ROLE(하위 범주) |
| -------------- | ----------------------- | ----------- | ------------------------------------------ | --- | --------------- |
| 1. 회원 관리   | 1.1 이메일 가입         | POST        | /auth/register                             | X   | ALL             |
|                | 1.2 로그인              | POST        | /auth/login                                | X   | ALL             |
|                | 1.3 로그아웃            | GET         | /auth/logout                               | O   | USER            |
|                | 1.4 로그인 갱신         | GET         | /auth/token/refresh                        | O   | USER            |
|                | 1.5 토큰 무효화         | GET         | /auth/token/revoke/:id                     | O   | ADMIN           |
|                | 1.6 유저 목록 조회      | GET         | /user                                      | O   | ADMIN           |
|                | 1.7 유저 상세 조회      | GET         | /user/:id                                  | O   | ADMIN           |
|                | 1.8 유저 삭제           | DELETE      | /user/:id                                  | O   | ADMIN           |
| 2. 게시글 관리 | 2.1 게시글 목록 조회    | GET         | /post?search=&take=&draft=&cursor=&order[] | X   | ALL             |
|                | 2.2 게시글 상세 조회    | GET         | /post/:id                                  | X   | ALL             |
|                | 2.3 게시글 등록         | POST        | /post                                      | O   | ADMIN           |
|                | 2.4 게시글 수정         | PATCH       | /post/:id                                  | O   | ADMIN           |
|                | 2.5 게시글 삭제         | DELETE      | /post/:id                                  | O   | ADMIN           |
|                | 2.6 게시글 좋아요       | POST        | /post/like/:id                             | X   | ALL             |
|                | 2.7 이미지 업로드       | POST        | /common/image                              | O   | ADMIN           |
|                | 2.8 태그 목록 조회      | GET         | /tag                                       | X   | ALL             |
|                | 2.9 태그 상세 조회      | GET         | /tag/:id                                   | X   | ALL             |
|                | 2.10 태그 생성          | POST        | /tag                                       | O   | ADMIN           |
|                | 2.11 태그 수정          | PATCH       | /tag/:id                                   | O   | ADMIN           |
|                | 2.12 태그 삭제          | DELETE      | /tag/:id                                   | O   | ADMIN           |
|                | 2.13 카테고리 목록 조회 | GET         | /category                                  | X   | ALL             |
|                | 2.14 카테고리 상세 조회 | GET         | /category/:id                              | X   | ALL             |
|                | 2.15 카테고리 생성      | POST        | /category                                  | O   | ADMIN           |
|                | 2.16 카테고리 수정      | PATCH       | /category/:id                              | O   | ADMIN           |
|                | 2.17 카테고리 삭제      | DELETE      | /category/:id                              | O   | ADMIN           |
|                | 2.18 댓글 작성(회원)    | POST        | /post/comment/user                         | O   | USER            |
|                | 2.19 댓글 수정(회원)    | PATCH       | /post/comment/user/:id                     | O   | USER            |
|                | 2.20 댓글 삭제(회원)    | DELETE      | /post/comment/user/:id                     | O   | USER            |
|                | 2.21 댓글 작성(비회원)  | POST        | /post/comment/guest                        | X   | ALL             |
|                | 2.22 댓글 수정(비회원)  | PATCH       | /post/comment/guest/:id                    | X   | ALL             |
|                | 2.23 댓글 삭제(비회원)  | DELETE      | /post/comment/guest/:id                    | X   | ALL             |

### ⚡ ERD 설계

```mermaid
erDiagram
"GuestComment" {
  Int id PK
  String nickName
  String email
  String password
  String guestId FK
}
"Guest" {
  Int id PK
  String guestId UK
}
"Category" {
  Int id PK
  String name UK
  DateTime createdAt
  DateTime updatedAt
}
"Comment" {
  Int id PK
  String content
  DateTime createdAt
  DateTime updatedAt
  Int parentCommentId FK "nullable"
  Int postId FK
  Int authorId FK "nullable"
  Int guestId FK "nullable"
}
"Image" {
  Int id PK
  String url
  Int postId FK
}
"PostLike" {
  Int postId FK
  String guestId FK
  DateTime createdAt
}
"Post" {
  Int id PK
  String title UK
  String content
  DateTime createdAt
  DateTime updatedAt
  Int prevId "nullable"
  Int nextId "nullable"
  Boolean draft
  String summary
  Int authorId FK
  Int categoryId FK
}
"Tag" {
  Int id PK
  String name UK
}
"User" {
  Int id PK
  String name
  String email UK
  String password
  Role role
  DateTime createdAt
}
"_PostToTag" {
  String A FK
  String B FK
}
"GuestComment" }o--|| "Guest" : guest
"Comment" }o--o| "Comment" : parentComment
"Comment" }o--|| "Post" : post
"Comment" }o--o| "User" : author
"Comment" |o--o| "GuestComment" : guest
"Image" }o--|| "Post" : post
"PostLike" }o--|| "Post" : post
"PostLike" }o--|| "Guest" : guest
"Post" }o--|| "User" : author
"Post" }o--|| "Category" : category
"_PostToTag" }o--|| "Post" : Post
"_PostToTag" }o--|| "Tag" : Tag
```

### `GuestComment`

비회원 댓글 테이블

**Properties**

- `id`: Primary Key
- `nickName`: 닉네임
- `email`: 이메일
- `password`: 비밀번호(해시값)
- `guestId`
  > Foreign Key
  >
  > 작성자(비회원) ID [Guest.guestId](#Guest)

### `Guest`

비회원 테이블

**Properties**

- `id`: Primary Key
- `guestId`: 비회원 id, 프론트에서 생성

### `Category`

카테고리 테이블

**Properties**

- `id`: Primary Key
- `name`: 카테고리 이름
- `createdAt`: 생성일
- `updatedAt`: 수정일

### `Comment`

댓글 테이블

**Properties**

- `id`: Primary Key
- `content`: 내용
- `createdAt`: 생성일
- `updatedAt`: 수정일
- `parentCommentId`
  > Foreign Key
  >
  > 부모 댓글 ID [Comment.id](#Comment)
- `postId`
  > Foreign Key
  >
  > 게시글 ID [Post.id](#Post)
- `authorId`
  > Foreign Key
  >
  > 작성자(회원) ID [User.id](#User)
- `guestId`
  > Foreign Key
  >
  > 작성자(비회원) ID [GuestComment.id](#GuestComment)

### `Image`

이미지 테이블

**Properties**

- `id`: Primary Key
- `url`: 이미지 url
- `postId`
  > Foreign Key
  >
  > 게시글 ID [Post.id](#Post)

### `PostLike`

비회원 <=> 게시글 : 다대다, 게시글 좋아요 테이블

**Properties**

- `postId`
  > Foreign Key
  >
  > 게시글 ID [Post.id](#Post)
- `guestId`
  > Foreign Key
  >
  > 비회원 ID [Guest.guestId](#Guest)
- `createdAt`: 좋아요가 눌린 날짜

### `Post`

게시글 테이블

**Properties**

- `id`: Primary Key
- `title`: 제목
- `content`: 내용
- `createdAt`: 생성일
- `updatedAt`: 수정일
- `prevId`: 이전 게시글 Id
- `nextId`: 다음 게시글 Id
- `draft`: 초안
- `summary`: 내용 요약
- `authorId`
  > Foreign Key
  >
  > 작성자 ID [User.id](#User)
- `categoryId`
  > Foreign Key
  >
  > 작성자 ID [Category.id](#Category)

### `Tag`

태그 테이블

**Properties**

- `id`: Primary Key
- `name`: 태그 이름

### `User`

회원 테이블

**Properties**

- `id`: Primary Key
- `name`: 이름
- `email`: 이메일
- `password`: 비밀번호(해시값)
- `role`: 역할
- `createdAt`: 생성일

### `_PostToTag`

Pair relationship table between [Post](#Post) and [Tag](#Tag)

**Properties**

- `A`:
- `B`:
