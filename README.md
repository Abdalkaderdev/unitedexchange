# United Exchange - Internal Money Exchange System

An internal web application for managing money exchange operations, built with React, Node.js, Express, and MySQL.

## Features

- **Authentication**: JWT-based auth with Admin and Employee roles
- **Multi-language Support**: English, Arabic, and Kurdish (Sorani) with RTL support
- **Currency Management**: Manage currencies and manual exchange rates
- **Transactions**: Record and track exchange transactions
- **Reports**: Daily and monthly reports with filtering

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, React Router, i18next
- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Authentication**: JWT

## Project Structure

```
unitedexchange/
├── backend/
│   ├── migrations/          # Database migrations and seeds
│   ├── src/
│   │   ├── config/          # Database and JWT configuration
│   │   ├── controllers/     # Route controllers
│   │   ├── middleware/      # Auth, validation, error handling
│   │   ├── routes/          # API routes
│   │   ├── utils/           # Helper functions
│   │   └── index.js         # Express app entry point
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/      # React components
    │   │   ├── common/      # Reusable UI components
    │   │   ├── layout/      # Layout components
    │   │   ├── currencies/  # Currency management
    │   │   ├── transactions/# Transaction components
    │   │   └── reports/     # Report components
    │   ├── contexts/        # React contexts (Auth)
    │   ├── hooks/           # Custom hooks
    │   ├── i18n/            # Internationalization
    │   │   └── locales/     # Translation files
    │   ├── pages/           # Page components
    │   ├── services/        # API services
    │   └── utils/           # Utility functions
    ├── .env.example
    └── package.json
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm or yarn

### 1. Database Setup

```bash
# Create MySQL database
mysql -u root -p
CREATE DATABASE united_exchange CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=your_password
# DB_NAME=united_exchange
# JWT_SECRET=your-secret-key

# Run database migrations
npm run migrate

# Seed initial data
npm run seed

# Start the server
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start the development server
npm start
```

## Default Credentials

After running the seed script:

| Role     | Username  | Password     |
|----------|-----------|--------------|
| Admin    | admin     | admin123     |
| Employee | employee  | employee123  |

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/change-password` - Change password

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PUT /api/users/:uuid` - Update user
- `PUT /api/users/:uuid/reset-password` - Reset user password

### Currencies
- `GET /api/currencies` - List currencies
- `POST /api/currencies` - Create currency (Admin)
- `PUT /api/currencies/:id` - Update currency (Admin)
- `GET /api/currencies/rates` - Get exchange rates
- `POST /api/currencies/rates` - Set exchange rate (Admin)

### Transactions
- `GET /api/transactions` - List transactions (with pagination/filters)
- `POST /api/transactions` - Create transaction
- `GET /api/transactions/:uuid` - Get transaction details

### Reports
- `GET /api/reports/dashboard` - Dashboard statistics
- `GET /api/reports/daily` - Daily report
- `GET /api/reports/monthly` - Monthly report

## Deployment (Ubuntu VPS)

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

### 2. Deploy Backend

```bash
cd /var/www
git clone <repository> unitedexchange
cd unitedexchange/backend
npm install --production
cp .env.example .env
# Edit .env with production values

npm run migrate
npm run seed

# Start with PM2
pm2 start src/index.js --name "united-exchange-api"
pm2 save
pm2 startup
```

### 3. Deploy Frontend

```bash
cd /var/www/unitedexchange/frontend
npm install
npm run build
```

### 4. Configure Nginx

```nginx
# /etc/nginx/sites-available/unitedexchange
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /var/www/unitedexchange/frontend/build;
        try_files $uri /index.html;
    }

    # API Proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/unitedexchange /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Security Notes

1. Change default credentials immediately after deployment
2. Use strong JWT secret in production
3. Enable HTTPS with Let's Encrypt
4. Configure MySQL to only accept local connections
5. Set up firewall (UFW) to allow only ports 80, 443, and 22

## License

Internal use only - United Exchange
