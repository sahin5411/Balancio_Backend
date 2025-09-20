require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { scheduleMonthlyReports } = require('./scheduler/monthlyReportScheduler');
const { connectToDatabase } = require('./utils/db');

const app = express();

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Finance Tracker API',
    version: '1.0.0',
    description: 'API for Finance Tracker Backend',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Transaction: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
          },
          title: {
            type: 'string',
          },
          amount: {
            type: 'number',
          },
          type: {
            type: 'string',
            enum: ['income', 'expense'],
          },
          categoryId: {
            type: 'string',
          },
          date: {
            type: 'string',
            format: 'date',
          },
          description: {
            type: 'string',
          },
          userId: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Category: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          type: {
            type: 'string',
            enum: ['income', 'expense'],
          },
          color: {
            type: 'string',
          },
          icon: {
            type: 'string',
          },
          userId: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
          },
          email: {
            type: 'string',
            format: 'email',
          },
          name: {
            type: 'string',
          },
          firstName: {
            type: 'string',
          },
          lastName: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: ['./routes/*.js'], // Paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

// CORS configuration - Allow all origins
app.use(cors({
  origin: '*',  // Allow all origins
  credentials: true,
  optionsSuccessStatus: 200
}));

// Middleware
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Database connection
connectToDatabase().catch(err => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/test', require('./routes/test'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduleMonthlyReports();
});