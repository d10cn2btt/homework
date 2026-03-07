# Tasks: Quản lý người dùng với ACL & CRUD bài post

**Input**: Design documents from `specs/001-user-mgmt-acl/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.md, research.md, quickstart.md

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and base folder structures

- [x] T001 Initialize backend Node.js project with all dependencies (Express 4.18, Prisma 5, ioredis 5, firebase-admin 12, pino, nodemon, jest 29, supertest 6) in backend/package.json
- [x] T002 [P] Initialize frontend Vite + React project with all dependencies (React 18, React Router 6, firebase 10, axios 1.6, tailwindcss, vitest 1, @testing-library/react 14) in frontend/package.json
- [x] T003 [P] Create backend and frontend folder structures per plan.md (backend/src/config/, backend/src/middlewares/, backend/src/controllers/, backend/src/services/, backend/src/routes/, backend/src/utils/, backend/tests/unit/middlewares/, backend/tests/unit/services/, backend/tests/integration/api/, backend/scripts/, frontend/src/api/, frontend/src/components/, frontend/src/config/, frontend/src/contexts/, frontend/src/pages/)
- [x] T004 [P] Create .env.example files with all required variables in backend/.env.example and frontend/.env.example

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create Prisma schema (User, Role, UserRole, Post models with enums, indexes, relations) and seed script for ADMIN/USER roles in backend/prisma/schema.prisma and backend/prisma/seed.js
- [x] T006 [P] Implement Prisma client singleton in backend/src/config/db.js
- [x] T007 [P] Implement ioredis client singleton (REDIS_URL env var, auto-reconnect) in backend/src/config/redis.js
- [x] T008 [P] Implement Firebase Admin SDK initialization (FIREBASE_SERVICE_ACCOUNT_PATH env var) in backend/src/config/firebase.js
- [x] T009 [P] Implement custom error classes (AppError, NotFoundError, ForbiddenError, UnauthorizedError, ConflictError) in backend/src/utils/errors.js
- [x] T010 [P] Implement pino structured logger (JSON output, exported singleton) in backend/src/utils/logger.js
- [x] T011 [P] Implement Redis cache service helpers (get, set with TTL, del) in backend/src/services/cache.service.js
- [x] T012 Implement auth middleware (verifyIdToken via Firebase Admin, set req.user = { uid, email }, return 401 on missing/invalid/expired token) in backend/src/middlewares/auth.mdw.js
- [x] T013 Implement ACL middleware factory (load roles from Redis cache → DB fallback, attach req.user.roles, check required role, return 403 on insufficient role) in backend/src/middlewares/acl.mdw.js
- [x] T014 Create Express app with JSON body parser, CORS, global error handler, and route mounting skeleton in backend/src/app.js
- [x] T015 [P] Initialize Firebase Client SDK (env vars: VITE_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, APP_ID) in frontend/src/config/firebase.js
- [x] T016 [P] Create Axios instance with request interceptor that attaches Firebase ID token as Bearer token in frontend/src/api/axios.js

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Dang nhap an toan (Priority: P1) MVP

**Goal**: User signs in with email/password via Firebase, profile is synced to DB, redirected to dashboard showing display_name. Unauthenticated users are redirected to /login.

**Independent Test**: Login with valid credentials → dashboard shows user's name. Wrong credentials → error message stays on /login. Navigate directly to /dashboard without auth → redirected to /login. Sign out → redirected to /login.

### Tests for User Story 1

- [x] T017 [P] [US1] Write unit tests for auth middleware (valid token sets req.user, expired token returns 401, missing Bearer token returns 401, malformed token returns 401) in backend/tests/unit/middlewares/auth.mdw.test.js

### Implementation for User Story 1

- [x] T018 [US1] Implement users service findOrCreateUser (upsert user by Firebase UID, assign USER role on create, return user with roles array) in backend/src/services/users.service.js
- [x] T019 [US1] Implement auth controller (POST /api/auth/sync: call findOrCreateUser, return 201 on create / 200 on existing, include roles in response) in backend/src/controllers/auth.controller.js
- [x] T020 [P] [US1] Implement profile controller (GET /api/me returns user + roles, PUT /api/me updates display_name with 1-100 char validation) in backend/src/controllers/profile.controller.js
- [x] T021 [US1] Create auth routes (POST /api/auth/sync with auth middleware) and profile routes (GET/PUT /api/me with auth middleware) and mount in app.js in backend/src/routes/auth.routes.js and backend/src/routes/profile.routes.js
- [x] T022 [P] [US1] Implement AuthContext (Firebase onAuthStateChanged, call POST /api/auth/sync on sign-in, expose currentUser, userRoles, loading state, signOut function) in frontend/src/contexts/AuthContext.jsx
- [x] T023 [P] [US1] Implement ProtectedRoute component (redirect to /login if !currentUser, show LoadingSpinner while loading) in frontend/src/components/ProtectedRoute.jsx
- [x] T024 [US1] Implement LoginPage with Firebase signInWithEmailAndPassword, form validation, friendly error messages (wrong credentials, service unavailable) in frontend/src/pages/LoginPage.jsx
- [x] T025 [US1] Implement DashboardPage showing authenticated user's display_name and role in frontend/src/pages/DashboardPage.jsx
- [x] T026 [US1] Configure React Router with ProtectedRoute wrapping all protected pages, /login as public route, navigation bar with sign-out button in frontend/src/App.jsx

**Checkpoint**: US1 fully functional — login/logout, auth redirect, dashboard with user name

---

## Phase 4: User Story 2 - Nguoi dung quan ly bai post CRUD (Priority: P2)

**Goal**: Any authenticated user can list/search/create/view posts. Authors and ADMIN can edit/delete. Non-authors get 403 on edit/delete.

**Independent Test**: Login, create a post with title+content, verify it appears in list, edit it, delete it. Log in as different user and attempt PUT/DELETE on the first user's post → 403 error shown.

### Implementation for User Story 2

- [x] T027 [P] [US2] Implement posts service (listPosts with offset pagination + case-insensitive title search, createPost, findById, updatePost with author_id/ADMIN ownership check, deletePost with ownership check, display "Nguoi dung da xoa" for null author) in backend/src/services/posts.service.js
- [x] T028 [P] [US2] Implement posts controller (GET /api/posts with page/limit/search query params, POST /api/posts with title+content validation, GET /api/posts/:id, PUT /api/posts/:id with 403/404 handling, DELETE /api/posts/:id with 403/404 handling) in backend/src/controllers/posts.controller.js
- [x] T029 [US2] Create posts routes with auth middleware for all endpoints and mount in app.js in backend/src/routes/posts.routes.js
- [x] T030 [P] [US2] Implement PostsPage with paginated post list (title, author display_name), title search input, "New Post" button, and navigation to detail page in frontend/src/pages/PostsPage.jsx
- [x] T031 [P] [US2] Implement PostDetailPage showing full post content, author name (or "Nguoi dung da xoa"), and edit/delete buttons visible only to post author or ADMIN in frontend/src/pages/PostDetailPage.jsx
- [x] T032 [US2] Implement PostFormPage for create and edit modes (title + content fields with validation, 400/403/404 error handling, redirect to detail on success) in frontend/src/pages/PostFormPage.jsx

**Checkpoint**: US2 fully functional — full posts CRUD with ownership enforcement

---

## Phase 5: User Story 3 - Admin quan ly nguoi dung (Priority: P3)

**Goal**: ADMIN can list, create, update (display_name/status), and hard-delete users. Non-admin access returns 403. Deleted user's posts remain with null author.

**Independent Test**: Login as ADMIN, list users, create new user with email+password, update display_name, disable (INACTIVE), delete → posts remain with "Nguoi dung da xoa". Login as USER and access /users → 403 redirect.

### Implementation for User Story 3

- [x] T033 [P] [US3] Extend users service with listUsers (paginated), createUser (Firebase Admin createUser + DB upsert + USER role), updateUser (display_name/status with last-admin guard for INACTIVE), deleteUser (transaction: orphan posts → delete user_roles → delete user → del Redis cache) in backend/src/services/users.service.js
- [x] T034 [P] [US3] Implement users controller (GET /api/users with pagination, POST /api/users with email+display_name+password validation, GET /api/users/:id, PUT /api/users/:id, DELETE /api/users/:id with last-admin guard, 409 for duplicate email) in backend/src/controllers/users.controller.js
- [x] T035 [US3] Create users routes with auth + ADMIN-only ACL middleware for all endpoints and mount in app.js in backend/src/routes/users.routes.js
- [x] T036 [P] [US3] Implement AdminRoute component (redirect to /403 if userRoles does not include ADMIN, show LoadingSpinner while loading) in frontend/src/components/AdminRoute.jsx
- [x] T037 [P] [US3] Implement UsersPage with paginated user list (name, email, status badge), "Add User" button, and navigation to detail page, wrapped in AdminRoute in frontend/src/pages/UsersPage.jsx
- [x] T038 [US3] Implement UserDetailPage with user info display, edit form (display_name, status toggle), delete button with confirmation dialog, and 403/404 error handling in frontend/src/pages/UserDetailPage.jsx

**Checkpoint**: US3 fully functional — admin can manage all users

---

## Phase 6: User Story 4 - Admin phan quyen vai tro (Priority: P4)

**Goal**: ADMIN can change any user's role (USER <-> ADMIN). Change is effective on user's next request. Redis cache is invalidated synchronously. Security log is written.

**Independent Test**: Admin changes USER to ADMIN → next request by that user succeeds on admin endpoint. Admin changes ADMIN to USER → user gets 403 on admin endpoint. Attempt to demote last admin → 400 error shown.

### Tests for User Story 4

- [x] T039 [P] [US4] Write unit tests for roles service (assignRole updates DB and deletes Redis key, last-admin guard returns error when only 1 admin, security log is written with correct fields) in backend/tests/unit/services/roles.service.test.js
- [x] T040 [P] [US4] Write integration test verifying PATCH /api/users/:id/role deletes Redis key user:roles:{uid} immediately after role change in backend/tests/integration/api/roles.test.js

### Implementation for User Story 4

- [x] T041 [US4] Implement roles service (assignRole: last-admin guard, delete old UserRole, create new UserRole, del Redis key user:roles:{uid}, log role_changed event with actor_uid/target_uid/old_roles/new_role/timestamp via pino) in backend/src/services/roles.service.js
- [x] T042 [US4] Add PATCH /api/users/:id/role endpoint to users controller (validate role is ADMIN or USER, call assignRole, return updated roles) and add route with auth + ADMIN ACL in backend/src/controllers/users.controller.js and backend/src/routes/users.routes.js
- [x] T043 [US4] Add role assignment UI (role dropdown with ADMIN/USER options and save button) to UserDetailPage, show 400 error for last-admin demotion attempt in frontend/src/pages/UserDetailPage.jsx

**Checkpoint**: US4 fully functional — role changes take effect on next request, cache invalidated immediately

---

## Phase 7: User Story 5 - Kiem soat quyen truy cap theo vai tro (Priority: P5)

**Goal**: All ACL rules enforced end-to-end. UI hides (not disables) unauthorized actions. Disabled users are rejected. Last admin cannot be demoted or disabled.

**Independent Test**: Login as USER → /users page redirects to 403. Create post, try to edit another user's post → 403 message shown. Disable user mid-session → next request returns 401 and frontend redirects to login.

### Tests for User Story 5

- [x] T044 [P] [US5] Write unit tests for ACL middleware (cache-hit ADMIN passes, cache-hit USER without required role returns 403, cache-miss queries DB and caches result, cache-miss no role found returns 403) in backend/tests/unit/middlewares/acl.mdw.test.js
- [x] T045 [P] [US5] Write unit tests for cache service (get returns parsed JSON or null, set stores JSON with TTL, del removes key) in backend/tests/unit/services/cache.service.test.js

### Implementation for User Story 5

- [x] T046 [US5] Add INACTIVE user status check to auth middleware (after verifyIdToken, query DB for user status, return 403 with redirect hint if INACTIVE) in backend/src/middlewares/auth.mdw.js
- [x] T047 [P] [US5] Implement ErrorPage component handling 401/403/404/500 with friendly messages and navigation back to home in frontend/src/pages/ErrorPage.jsx
- [x] T048 [P] [US5] Implement LoadingSpinner component and integrate into AuthContext loading state, PostsPage, UsersPage, PostDetailPage, UserDetailPage in frontend/src/components/LoadingSpinner.jsx
- [x] T049 [US5] Hide (not disable) edit/delete buttons based on role and ownership in PostDetailPage and PostsPage; hide admin navigation links for non-ADMIN in App.jsx in frontend/src/pages/PostDetailPage.jsx and frontend/src/App.jsx

**Checkpoint**: US5 fully functional — complete ACL enforcement, UI role-aware, disabled user handling

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Scripts, integration tests, and final validation

- [x] T050 Create seed-admin.js script (accept Firebase UID as CLI arg, assign ADMIN role, remove USER role) in backend/scripts/seed-admin.js
- [x] T051 [P] Write integration tests for auth sync flow (POST /api/auth/sync creates profile + USER role on first call, returns existing on repeat call) in backend/tests/integration/api/auth.test.js
- [x] T052 [P] Write integration tests for posts API (authenticated CRUD, ownership enforcement, pagination + search) in backend/tests/integration/api/posts.test.js
- [x] T053 [P] Write integration tests for users API (admin CRUD, 403 for non-admin, duplicate email 409, last-admin guards) in backend/tests/integration/api/users.test.js
- [x] T054 Configure Jest with coverage thresholds (>=80% for middlewares/ and services/) and --runInBand flag in backend/jest.config.js and backend/package.json
- [x] T055 Validate implementation against quickstart.md smoke tests (sync, list posts, create post via curl)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — can start immediately after Foundational
- **US2 (Phase 4)**: Depends on Phase 2 — can start after Foundational (independent of US1)
- **US3 (Phase 5)**: Depends on Phase 2 — can start after Foundational (independent of US1/US2)
- **US4 (Phase 6)**: Depends on US3 (needs users management base) and Phase 2
- **US5 (Phase 7)**: Depends on US1 + US4 (auth flow + ACL infrastructure complete)
- **Polish (Final)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Foundational complete — no other story dependency
- **US2 (P2)**: Foundational complete — no other story dependency (can run parallel with US1)
- **US3 (P3)**: Foundational complete — no other story dependency (can run parallel with US1/US2)
- **US4 (P4)**: US3 complete (role assignment extends user management)
- **US5 (P5)**: US1 + US4 complete (needs full auth + role change flow in place)

### Within Each User Story

- Config/utility files before middleware
- Middleware before controller
- Service before controller
- Controller before routes
- Backend routes before frontend pages (API must exist to develop against)
- Tests written before implementation (for explicitly required tests)

---

## Parallel Opportunities

### Phase 2 — Foundational

```
Parallel batch 1 (all independent):
  T006 backend/src/config/db.js
  T007 backend/src/config/redis.js
  T008 backend/src/config/firebase.js
  T009 backend/src/utils/errors.js
  T010 backend/src/utils/logger.js
  T011 backend/src/services/cache.service.js
  T015 frontend/src/config/firebase.js
  T016 frontend/src/api/axios.js

Sequential after batch 1:
  T012 auth.mdw.js  (uses firebase.js + errors.js)
  T013 acl.mdw.js   (uses redis.js + errors.js + cache.service.js)
  T014 app.js       (uses auth.mdw.js + acl.mdw.js)
```

### Phase 3 — US1

```
Parallel batch:
  T017 auth.mdw.test.js
  T020 profile.controller.js
  T022 AuthContext.jsx
  T023 ProtectedRoute.jsx

Sequential after batch:
  T018 users.service.js (findOrCreate)
  T019 auth.controller.js  (uses users.service)
  T021 auth.routes.js + profile.routes.js
  T024 LoginPage.jsx
  T025 DashboardPage.jsx
  T026 App.jsx
```

### Phase 4 — US2

```
Parallel batch:
  T027 posts.service.js
  T028 posts.controller.js
  T030 PostsPage.jsx
  T031 PostDetailPage.jsx

Sequential after batch:
  T029 posts.routes.js (uses controller)
  T032 PostFormPage.jsx (integrates with routes)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (login + profile sync + dashboard)
4. **STOP and VALIDATE**: Login works end-to-end, unauthenticated redirect works
5. Demo/deploy MVP

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. US1 (P1) → working authentication — demo login flow
3. US2 (P2) → users can manage posts — demo core content feature
4. US3 (P3) → admin can manage users — demo admin panel
5. US4 (P4) → role assignment with cache invalidation — demo ACL changes
6. US5 (P5) → full ACL enforcement + UI hardening — production-ready
7. Polish → integration tests, scripts, validation

### Parallel Team Strategy

Once Phase 2 (Foundational) is complete:
- Developer A: US1 (authentication)
- Developer B: US2 (posts CRUD)
- Developer C: US3 (admin user management)

US4 and US5 require US1/US3 complete — merge and continue sequentially.

---

## Notes

- Tests marked [P] within a story can all be written simultaneously before any implementation
- `users.service.js` is built incrementally: US1 adds findOrCreate, US3 adds CRUD, US4 adds role assignment
- `users.controller.js` and `users.routes.js` are similarly extended across US3 and US4
- The last-admin guard must be implemented in US3 (updateUser) and US4 (assignRole) — both call the same check
- Redis cache key pattern: `user:roles:{uid}` — invalidated synchronously in same request as role change
- All UI role restrictions use **hide** (conditional render), never `disabled` attribute
- pino security log for role changes is mandatory per Constitution Principle V
