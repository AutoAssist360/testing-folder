# REST API with Prisma and PostgreSQL

A modern REST API built with Express.js, Prisma ORM, and PostgreSQL. This project demonstrates how to build a scalable API with proper database management and TypeScript type safety.

## Features

- **Express.js** - Lightweight and flexible web framework
- **Prisma ORM** - Type-safe database client with migrations
- **PostgreSQL** - Robust relational database
- **TypeScript** - Full type safety and better developer experience
- **CORS** - Cross-Origin Resource Sharing enabled
- **Morgan** - HTTP request logger middleware
- **Docker Compose** - Easy database setup and deployment

## Project Structure

```
rest-api-with-prisma-and-postgres/
├── src/
│   ├── index.ts              # Application entry point
│   ├── server.ts             # Express app and route definitions
│   └── lib/
│       └── prisma.ts         # Prisma client instance
├── prisma/
│   ├── schema.prisma         # Database schema definition
│   └── migrations/           # Database migration history
├── generated/
│   └── prisma/              # Auto-generated Prisma types
├── docker-compose.yml        # PostgreSQL container setup
├── package.json             # Project dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── api-test.http            # HTTP request examples
```

## Database Schema

The project includes two main models:

### User
- `id` (Int, Primary Key) - Auto-incrementing unique identifier
- `email` (String, Unique) - User email address
- `name` (String, Optional) - User's full name
- `posts` - Relation to Post model

### Post
- `id` (Int, Primary Key) - Auto-incrementing unique identifier
- `title` (String) - Post title
- `content` (String, Optional) - Post content
- `published` (Boolean) - Publication status
- `author` (User) - Author relation
- `authorId` (Int, Foreign Key) - Reference to User

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for database)
- PostgreSQL (if not using Docker)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd rest-api-with-prisma-and-postgres
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```
   DATABASE_URL="postgresql://postgres:secret@localhost:5432/postgres"
   PORT=3000
   ```

4. **Start PostgreSQL with Docker**
   ```bash
   docker-compose up -d
   ```

5. **Run database migrations**
   ```bash
   npx prisma migrate dev
   ```

## Running the Application

### Development Mode
Runs with hot-reload enabled:
```bash
npm run dev
```

### Production Mode
Compiles and runs the application:
```bash
npm start
```

The server will start on `http://localhost:3000` by default.

## API Endpoints

### Users

- **GET `/users`** - Retrieve all users
  ```bash
  curl http://localhost:3000/users
  ```

- **POST `/users`** - Create a new user
  ```bash
  curl -X POST http://localhost:3000/users \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com","name":"John Doe"}'
  ```

### Posts

- **GET `/posts`** - Retrieve all posts
  ```bash
  curl http://localhost:3000/posts
  ```

- **GET `/posts/:id`** - Retrieve a specific post by ID
  ```bash
  curl http://localhost:3000/posts/1
  ```

- **GET `/feed`** - Retrieve all published posts with author information
  ```bash
  curl http://localhost:3000/feed
  ```

- **POST `/posts`** - Create a new post
  ```bash
  curl -X POST http://localhost:3000/posts \
    -H "Content-Type: application/json" \
    -d '{"title":"My Post","content":"Post content","authorEmail":"user@example.com"}'
  ```

- **PUT `/posts/publish/:id`** - Publish a post
  ```bash
  curl -X PUT http://localhost:3000/posts/publish/1
  ```

- **DELETE `/posts/:id`** - Delete a post
  ```bash
  curl -X DELETE http://localhost:3000/posts/1
  ```

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with hot-reload

## Database Management

### Prisma Studio
View and manage your database data with a visual interface:
```bash
npx prisma studio
```

### Generate Prisma Client
Generate type definitions after schema changes:
```bash
npx prisma generate
```

### Create Migration
Create a new migration after modifying the schema:
```bash
npx prisma migrate dev --name <migration-name>
```

## Dependencies

### Runtime
- **express** (^5.2.1) - Web framework
- **@prisma/client** (^7.3.0) - Prisma ORM client
- **@prisma/adapter-pg** (^7.3.0) - PostgreSQL adapter for Prisma
- **pg** (^8.17.2) - PostgreSQL client for Node.js
- **cors** (^2.8.6) - CORS middleware
- **morgan** (^1.10.1) - HTTP request logger
- **dotenv** (^17.2.3) - Environment variable management

### Development
- **typescript** (^5.9.3) - TypeScript compiler
- **tsx** (^4.21.0) - TypeScript executor for development
- **prisma** (^7.3.0) - Prisma CLI
- **@types/express**, **@types/cors**, **@types/morgan**, **@types/node**, **@types/pg** - TypeScript type definitions

## Docker Setup

The `docker-compose.yml` includes a PostgreSQL service:

**Configuration:**
- Image: PostgreSQL 18.1
- Username: `postgres`
- Password: `secret`
- Port: `5432`
- Volume: Named volume for data persistence

**Start the database:**
```bash
docker-compose up -d
```

**Stop the database:**
```bash
docker-compose down
```

**View logs:**
```bash
docker-compose logs postgres
```

## Development Tips

1. **Type Safety** - Always use TypeScript for full type safety with Prisma
2. **Migrations** - Keep your migrations organized and version controlled
3. **Environment Variables** - Never commit `.env` files with sensitive data
4. **Error Handling** - Consider adding proper error handling middleware in production
5. **Validation** - Add request validation middleware for production APIs

## Next Steps

- Add request validation with libraries like `zod` or `joi`
- Implement authentication and authorization
- Add error handling middleware
- Write unit and integration tests
- Set up CI/CD pipeline
- Add API documentation with Swagger/OpenAPI

## License

ISC

## Author

Created as a tutorial project demonstrating REST API development with modern Node.js tools.
