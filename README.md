# Multi-Serv

A modern multi-tenant service marketplace built with Next.js, Payload CMS, and Clerk authentication.

## 🚀 Features

- **Multi-tenant Architecture**: Isolated tenant spaces with Payload CMS multi-tenant plugin
- **Authentication**: Secure user management with Clerk
- **Real-time Filtering**: URL-based filtering with nuqs for tenant discovery
- **Type Safety**: Full TypeScript implementation with tRPC
- **Modern UI**: Beautiful interface with shadcn/ui components
- **Responsive Design**: Mobile-first approach with Tailwind CSS

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **CMS**: Payload CMS with MongoDB
- **Authentication**: Clerk
- **Database**: MongoDB with Mongoose
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: tRPC + React Query
- **Type Safety**: TypeScript
- **Payment Processing**: Stripe Connect
- **File Storage**: Vercel Blob Storage

## 📋 Current Tasks & TODOs

### 🔥 High Priority
- [ ] **Fix Clerk Middleware Issues**
  - Resolve `clerkMiddleware()` detection errors
  - Update middleware configuration for proper auth handling
  - Fix dehydrated query rejection errors

- [ ] **Security Improvements**
  - Add input validation to all tRPC procedures
  - Implement proper error handling patterns
  - Add comprehensive TypeScript types

- [ ] **Tenant Filtering System**
  - Complete filter integration with database queries
  - Add clear button functionality
  - Implement proper URL state management

### 🔧 Medium Priority
- [ ] **Code Quality**
  - Modularize large procedures into smaller functions
  - Add JSDoc documentation for complex procedures
  - Implement consistent error handling patterns

- [ ] **Performance Optimizations**
  - Add database indexes for frequently queried fields
  - Optimize tenant listing queries
  - Implement proper caching strategies

- [ ] **User Experience**
  - Add loading states for all async operations
  - Implement proper error boundaries
  - Add form validation feedback

### 📚 Low Priority
- [ ] **Documentation**
  - Add API documentation
  - Create deployment guide
  - Add contribution guidelines

- [ ] **Testing**
  - Add unit tests for critical business logic
  - Implement integration tests
  - Add end-to-end testing

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB instance
- Clerk account
- Stripe account
- Vercel account (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/vkasyan76/multi-serv.git
   cd multi-serv
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your environment variables:
   ```env
   # Database
   DATABASE_URI=your_mongodb_connection_string
   
   # Clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   
   # Payload
   PAYLOAD_SECRET=your_payload_secret
   
   # Stripe
   STRIPE_SECRET_KEY=your_stripe_secret_key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   
   # Vercel Blob
   BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
   ```

4. **Database Setup**
   ```bash
   npm run db:fresh
   npm run db:seed
   ```

5. **Generate Types**
   ```bash
   npm run generate:types
   ```

6. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
multi-serv/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (app)/             # Protected routes
│   │   ├── (auth)/            # Authentication pages
│   │   └── (payload)/         # Payload CMS admin
│   ├── collections/            # Payload CMS collections
│   ├── components/             # Shared UI components
│   │   ├── shared/            # Common components
│   │   └── ui/                # shadcn/ui components
│   ├── lib/                   # Utilities and configurations
│   ├── modules/               # Feature-based modules
│   │   ├── auth/              # Authentication logic
│   │   ├── categories/        # Category management
│   │   ├── profile/           # User profile management
│   │   └── tenants/           # Tenant/vendor management
│   └── trpc/                  # tRPC configuration
├── public/                    # Static assets
└── payload.config.ts          # Payload CMS configuration
```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run generate:types` - Generate Payload types
- `npm run db:fresh` - Reset database
- `npm run db:seed` - Seed database with sample data

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for Next.js and TypeScript
- **Prettier**: Code formatting
- **Conventional Commits**: For commit messages

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment

1. Build the project: `npm run build`
2. Start production server: `npm run start`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Payload CMS](https://payloadcms.com/) for the headless CMS
- [Clerk](https://clerk.com/) for authentication
- [shadcn/ui](https://ui.shadcn.com/) for beautiful components
- [tRPC](https://trpc.io/) for type-safe APIs
- [Vercel](https://vercel.com/) for hosting and deployment

## 📞 Support

For support, email support@multi-serv.com or create an issue in this repository.

---

**Note**: This project is actively under development. Some features may be incomplete or subject to change.
