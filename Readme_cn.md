# 多邮箱管理系统 (Multi-Mailbox Management System)

一个功能强大且现代化的邮件管理系统，旨在将多个邮箱账户（IMAP, Gmail）整合到一个统一的界面中。项目构建注重性能、用户体验和可扩展性。

## 功能特性 (Features)

- **统一收件箱**：在一个地方管理来自不同提供商的多个邮箱账户。
- **协议支持**：
  - 全面支持标准邮件提供商的 IMAP 协议。
  - 集成 Google/Gmail OAuth2 以实现安全访问。
- **实时更新**：基于 WebSocket 实现新邮件和同步状态的实时通知。
- **邮件管理**：
  - 使用标签 (Labels) 和自定义文件夹进行组织。
  - 邮件星标/取消星标。
  - 标记已读/未读。
  - 强大的筛选和搜索功能。
- **附件处理**：自动提取并安全存储附件（兼容 S3 存储）。
- **后台同步**：强大的后台服务，用于轮询和同步邮件。
- **开发者 API**：提供 RESTful API 及 API 密钥管理，便于外部集成。
- **现代 UI**：基于 React 19、Tailwind CSS 和 Radix UI 构建的精美响应式界面。

## 技术栈 (Tech Stack)

### 前端 (Frontend)
- **框架**: React 19 + Vite
- **样式**: Tailwind CSS, Tailwind Animate
- **组件库**: Radix UI, Shadcn/ui 生态系统
- **状态管理**: TanStack Query (React Query), tRPC Client
- **路由**: wouter
- **图标**: Lucide React

### 后端 (Backend)
- **运行时**: Node.js
- **服务器**: Express
- **API**: tRPC (类型安全 API), WebSocket (实时通讯)
- **验证**: Zod
- **认证**: JOSE (JWT/Session)
- **邮件引擎**: imapflow, mailparser, Google APIs

### 数据库与存储 (Database & Storage)
- **数据库**: MySQL
- **ORM**: Drizzle ORM
- **存储**: AWS S3 SDK (兼容 AWS S3, MinIO, Cloudflare R2 等)

## 快速开始 (Getting Started)

### 前置要求
- Node.js (推荐 v20+)
- pnpm (包管理器)
- MySQL 数据库

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone <repository-url>
   cd multi-mailbox
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **环境配置**
   在根目录下创建一个 `.env` 文件，并配置以下变量：

   ```env
   # 数据库配置
   DATABASE_URL=mysql://user:password@host:port/dbname

   # 安全配置
   JWT_SECRET=your_secure_jwt_secret
   # 拥有此 OpenID 的用户将自动获得管理员/所有者权限
   OWNER_OPEN_ID=your_admin_openid

   # 可选：本地默认管理员账号初始化（用户名/密码），默认关闭
   ADMIN_SEED_ENABLED=false
   ADMIN_SEED_USERNAME=admin
   ADMIN_SEED_PASSWORD=change_me_to_a_strong_password
   ADMIN_SEED_DISPLAY_NAME=Administrator

   # 服务器配置
   PORT=3000
   NODE_ENV=development
   VITE_APP_ID=your_app_id
   OAUTH_SERVER_URL=http://localhost:3000

   # Google OAuth2 (可选，用于支持 Gmail)
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret

   # AWS S3 / 对象存储 (可选，用于附件存储)
   # AWS_ACCESS_KEY_ID=...
   # AWS_SECRET_ACCESS_KEY=...
   # AWS_REGION=...
   # AWS_BUCKET_NAME=...
   ```

   `ADMIN_SEED_*` 说明：
   - 仅在 `ADMIN_SEED_ENABLED=true` 时执行初始化。
   - 初始化在服务启动时执行，且具备幂等性（重启不会重复创建凭据）。
   - 请使用高强度密码；初始化完成后建议关闭 seed。
   - 初始化成功后，服务日志会输出安全提醒，提示你关闭 seed 引导模式。

   登录限流：
   - 密码登录会按“用户名（归一化）+ 客户端 IP”维度限流。
   - 10 分钟内连续失败 5 次后，封禁 15 分钟。

4. **数据库设置**
   执行迁移到 MySQL 数据库：
   ```bash
   pnpm db:migrate
   ```

   如果你修改了 schema 并需要先生成迁移文件：
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

### 运行应用

**开发模式**
启动前端和后端，支持热重载。
```bash
pnpm dev
```

**生产构建**
构建用于生产环境的前端和后端。
```bash
pnpm build
```

**启动生产服务器**
```bash
pnpm start
```

## 项目结构 (Project Structure)

- `client/`: 前端 React 应用
  - `components/`: 可复用的 UI 组件
  - `pages/`: 应用路由和页面视图
  - `hooks/`: 自定义 React Hooks
- `server/`: 后端 Node.js 应用
  - `_core/`: 核心基础设施 (认证, WebSocket, 配置)
  - `services/`: 业务逻辑 (IMAP 同步, 轮询, 邮件处理)
  - `api/`: REST API 端点
  - `routers.ts`: tRPC 路由定义
- `shared/`: 前后端共享的类型和常量
- `drizzle/`: 数据库 Schema 和迁移文件

## 开源协议 (License)

MIT
