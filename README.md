# Vestov Client Portal

A comprehensive client portal for an outsourcing/outstaffing company built with modern web technologies. This application provides clients with project management, team collaboration, financial oversight, and complete vacation/leave management capabilities.

## 🚀 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Wouter** for lightweight routing
- **TanStack Query** for server state management
- **Tailwind CSS** for styling
- **Radix UI & Shadcn/ui** for accessible UI components

### Backend
- **Node.js** with Express.js and TypeScript
- **PostgreSQL** database
- **Drizzle ORM** for database operations
- **Passport.js** with local strategy for authentication
- **Session-based authentication** with secure cookies

## 🌟 Features

### Admin Portal
- **Dashboard** - Overview statistics and system health
- **Client Management** - CRUD operations for clients with contract information
- **Team Management** - Clickable card-based team member interface
- **Employee Details** - Comprehensive tabbed interface for employee information
- **Consolidated Vacation Management** - Complete leave management system with 4 main tabs:
  - Leave Requests (approve/deny/cancel)
  - Today's Time Off
  - This Week's Time Off
  - Team Calendar (planned)
- **Service Management** - Service types and client services
- **Document Management** - Upload/download with access control
- **Time Tracking** - Billable hours management
- **Feedback System** - Client and team feedback management

### Client Portal
- **Dashboard** - Project overview and team summary
- **Team View** - Assigned team members with contact information
- **Service Requests** - Submit and track service requests
- **Documents** - Access to project documents
- **Financial Overview** - Budget utilization and invoice history
- **Messaging** - Direct communication with delivery manager
- **Feedback** - Submit team member ratings and feedback

### Vacation Management System
- **Employment Cycles** - Automatic 1-year cycles from employee start date
- **Leave Types** - Vacation, Sick Leave, Personal Leave, etc.
- **Leave Balances** - Automatic balance calculations
- **Leave Requests** - With automatic days calculation including half-day support
- **Approval Workflow** - Admin approval/denial with audit trail
- **Calendar Integration** - Visual leave calendar (planned)

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- Git

## 🛠 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd vestov-client-portal
```

### 2. Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 3. Database Setup
```bash
# Create PostgreSQL database
createdb vestov_portal

# Copy environment variables
cp .env.example .env

# Edit .env with your database credentials
DATABASE_URL=postgresql://username:password@localhost:5432/vestov_portal
SESSION_SECRET=your-super-secret-session-key-change-in-production
NODE_ENV=development
PORT=3001
```

### 4. Run Database Migrations & Seeding
```bash
# Generate and run migrations
npm run db:generate
npm run db:migrate

# Seed initial data
npm run db:seed
```

### 5. Start the Development Servers
```bash
# Start both frontend and backend concurrently
npm run dev

# Or run separately:
# Frontend (port 5173)
npm run dev:client

# Backend (port 3001)
npm run dev:server
```

## Project Updates Slack Bot

The project bot is configured per client service, which is the project boundary in Vestov Hub. Each enabled project has exactly one Slack channel and one ClickUp List. Reports never fall back to a different channel or List.

### 1. Connect ClickUp

Open **Admin → Time Tracking**, connect the ClickUp workspace, and keep the integration active. The saved ClickUp token must be able to read every List assigned to a project bot and create tasks when Slack request capture is enabled.

### 2. Create the Slack app

Import [`server/slack-app-manifest.yml`](server/slack-app-manifest.yml) in Slack app settings after replacing `YOUR_PUBLIC_DOMAIN` with the deployed backend domain. Install the app to the workspace and invite it to every configured project channel, including private channels.

The manifest configures:

- `/project` slash command
- App mentions and channel-message events
- Interactive request-to-task buttons
- `chat:write`, `commands`, `app_mentions:read`, `channels:history`, and `groups:history` bot scopes

### 3. Configure server secrets

```env
PROJECT_BOT_ENABLED=true
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-signing-secret
```

`SLACK_BOT_TOKEN` is shared with the existing Slack notification integration. The project bot does not require `SLACK_NOTIFICATIONS_ENABLED`.

### 4. Configure each project

Open **Admin → Clients → Client → Service Assignments**, choose the project settings button, and complete the **Project updates bot** section:

- Slack Channel ID
- ClickUp List URL or numeric List ID
- Authorized Slack user IDs for task creation/linking
- Daily update time and IANA timezone

Saving extracts the numeric List ID from standard ClickUp List URLs, validates the List, and prevents two enabled projects from sharing one Slack channel. Project reports only include tasks tagged `cursprint`; tasks captured from Slack receive that tag automatically. An empty authorized-user list makes the bot read-only while preserving reports.

### Commands and behavior

Supported commands include `/project now`, `/project sprint`, `/project done`, `/project review`, `/project remaining`, `/project <team member>`, `/project needs-me`, `/project blocked`, `/project carryover`, `/project untracked`, and `/project changes-today`. Equivalent questions work when the bot is mentioned.

The bot only treats the explicit ClickUp **Completed** workflow status as production verified. Generic closed or unknown statuses remain unfinished and are called out as unmapped. Request-like Slack messages are matched against the configured List; ambiguous matches and task creation always require a button click from an allowlisted Slack user.

## 🔑 Default Login Credentials

After seeding the database, you can log in with:

### Admin User
- **Username:** `admin`
- **Password:** `admin123`

### Client User
- **Username:** `client`
- **Password:** `client123`

## 📁 Project Structure

```
vestov-client-portal/
├── src/                          # Frontend source code
│   ├── components/               # Reusable React components
│   │   ├── ui/                  # Shadcn/ui components
│   │   ├── AdminLayout.tsx      # Admin layout with sidebar
│   │   └── ClientLayout.tsx     # Client layout with sidebar
│   ├── pages/                   # Page components
│   │   ├── admin/               # Admin-specific pages
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── TeamPage.tsx     # Clickable team cards
│   │   │   ├── EmployeeDetailsPage.tsx # Tabbed employee details
│   │   │   ├── VacationPage.tsx # Consolidated leave management
│   │   │   ├── ClientsPage.tsx
│   │   │   └── ClientDetailsPage.tsx
│   │   ├── client/              # Client-specific pages
│   │   │   └── ClientDashboard.tsx
│   │   └── LoginPage.tsx        # Authentication page
│   ├── lib/                     # Utilities and API client
│   │   ├── api.ts              # API client with TanStack Query
│   │   └── utils.ts            # Helper functions
│   └── hooks/                   # Custom React hooks
├── server/                      # Backend source code
│   ├── src/
│   │   ├── db/                  # Database configuration
│   │   │   ├── schema.ts        # Drizzle schema definitions
│   │   │   └── index.ts         # Database connection
│   │   ├── routes/              # API route handlers
│   │   │   ├── auth.ts          # Authentication routes
│   │   │   ├── admin.ts         # Admin API endpoints
│   │   │   └── client.ts        # Client API endpoints
│   │   ├── auth/                # Authentication logic
│   │   │   └── passport.ts      # Passport.js configuration
│   │   ├── middleware/          # Express middleware
│   │   │   └── auth.ts          # Auth middleware
│   │   ├── utils/               # Backend utilities
│   │   │   └── dateUtils.ts     # Date calculation utilities
│   │   ├── migrate.ts           # Migration runner
│   │   ├── seed.ts             # Database seeding
│   │   └── index.ts            # Express server setup
│   └── drizzle/                # Generated migration files
├── drizzle.config.ts           # Drizzle configuration
└── README.md
```

## 🎯 Key Implementation Details

### Critical Features Implemented

1. **Team Management with Clickable Navigation**
   - Entire row/card clickable (no action buttons on list view)
   - Hover effects and keyboard navigation support
   - Direct navigation to employee details page

2. **Employee Details with Tabbed Interface**
   - Personal Info, Professional Info, Assignment History
   - Leave & Vacation, Documents, Feedback & Reviews
   - Base hourly rate display in Professional Info tab

3. **Consolidated Vacation Management**
   - All leave functionality in single page with 4 tabs
   - Automatic days calculation with half-day support
   - Approval workflow with audit trail
   - Real-time status updates

4. **Leave Request Days Calculation**
   - Backend calculation: `endDate - startDate + 1 - halfDayAdjustments`
   - Automatic generation of employment cycles
   - Balance impact preview

5. **Session-based Authentication**
   - Secure session cookies with PostgreSQL store
   - Role-based access control (admin/client)
   - Automatic session cleanup

## 🔒 Security Features

- **Authentication:** Session-based with secure cookies
- **Authorization:** Role-based access control with middleware
- **CSRF Protection:** Built-in Express session protection
- **Rate Limiting:** Login attempt limiting
- **Input Validation:** Server-side validation for all inputs
- **Security Headers:** Helmet.js for security headers

## 📊 Database Schema

The application uses a comprehensive PostgreSQL schema with:
- Users and authentication
- Clients and team members
- Employment cycles and leave management
- Service types and client services
- Documents, time entries, and feedback
- Audit trails for leave requests

## 🚀 Production Deployment

### Build for Production
```bash
npm run build
```

### Production Environment Variables
```bash
DATABASE_URL=postgresql://prod-user:prod-password@prod-host:5432/vestov_portal
SESSION_SECRET=super-secure-production-secret
NODE_ENV=production
PORT=3001
```

### Start Production Server
```bash
npm start
```

## 🧪 Testing

The application includes comprehensive test scenarios for:
- User authentication flow
- Leave request creation with days calculation
- Leave request approval/denial workflow
- Team member navigation (clickable rows)
- Employee details tab navigation
- Balance calculations
- Calendar view functionality

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔮 Future Enhancements

- Email notifications for leave requests
- Integration with external HR systems
- Advanced reporting and analytics
- Multi-language support
- Mobile app version
- Two-factor authentication
- Bulk operations for admin
- Export to various formats (PDF, Excel)
- Automated leave accrual calculations
- Public holiday management

## 📞 Support

For support and questions, please open an issue in the GitHub repository.

---

Built with ❤️ using modern web technologies for efficient client portal management.
