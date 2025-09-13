# Finance Tracker Backend

## Setup
1. Install dependencies: `npm install`
2. Create `.env` file with your MongoDB URI and JWT secret
3. Start MongoDB service
4. Run development server: `npm run dev`

## API Endpoints
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/transactions` - Get user transactions
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction
- `GET /api/categories` - Get user categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile