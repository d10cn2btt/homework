# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a homework project (early planning stage, no code written yet) to build a CRUD web application with user management, role-based access control (ACL), and Firebase Authentication.

## Planned Tech Stack

- **Frontend**: React (Vite) with Firebase JS SDK
- **Backend**: Node.js + Express with Firebase Admin SDK
- **Database**: PostgreSQL or MySQL with Prisma/Sequelize/Knex ORM
- **Cache**: Redis
- **Auth**: Firebase Authentication (email/password — no custom password hashing)

## Architecture

### Authentication Flow

1. React client signs in via Firebase JS SDK, receives an ID Token
2. All API requests send `Authorization: Bearer <FIREBASE_ID_TOKEN>`
3. Express `auth.mdw.js` calls `admin.auth().verifyIdToken()` to extract `uid`
4. Express `acl.mdw.js` checks the user's role before passing to the controller

### Role-Based Access Control (DB-backed with Redis cache)

**DB schema:**
- `users`: `id` (Firebase UID), `email`, `display_name`, `status`
- `roles`: `id`, `name` (e.g., `ADMIN`, `USER`)
- `user_roles`: `user_id`, `role_id`

**Redis caching strategy:**
- Cache key: `user:roles:{uid}` — value is an array of role names (e.g., `["ADMIN"]`)
- TTL: 1 hour
- On cache miss: query DB, then write to Redis
- Cache invalidation: when a user's role changes, the API must delete `user:roles:{uid}` from Redis immediately after updating the DB

### Planned Folder Structure

**Backend:**
```
backend/src/
  config/        # DB, Redis, Firebase Admin init
  middlewares/
    auth.mdw.js  # Verifies Firebase token -> sets req.user
    acl.mdw.js   # Reads roles from Redis/DB, checks permission
  controllers/   # CRUD logic
  services/      # DB/Redis calls
  routes/        # API endpoint definitions
  utils/
  app.js
```

**Frontend:**
```
frontend/src/
  api/           # Axios instance with auto token attachment
  components/    # Shared UI components
  config/
    firebase.js  # Firebase Client SDK init
  contexts/      # AuthContext (current user state)
  pages/         # Login, Dashboard, Users, etc.
  App.jsx        # Router & layout
```
