# Event Booking System - Frontend

A modern, responsive React frontend application for the Event Booking System. This application provides an intuitive interface for users to browse shows, book seats, and manage their bookings, while offering comprehensive admin tools for managing venues, events, shows, and monitoring system activity.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [User Flow](#user-flow)
- [Admin Flow](#admin-flow)
- [Authentication](#authentication)
- [Booking Process](#booking-process)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [API Integration](#api-integration)
- [Responsive Design](#responsive-design)
- [Key Features & Details](#key-features--details)

## Features

### User Features

- **Authentication**
  - User registration with email and password
  - Secure login with JWT token (stored in HTTP-only cookies)
  - Automatic session persistence
  - Protected routes based on authentication status

- **Show Browsing**
  - Browse all available shows on the home page
  - View detailed show information (event, venue, date, time)
  - Filter and search shows
  - View seat availability in real-time

- **Seat Selection & Booking**
  - Interactive seat map visualization
  - Select multiple seats at once
  - Real-time seat status (Available, Booked, Locked)
  - Seat selection persistence across page refreshes
  - Lock seats for booking (temporary reservation)
  - Confirm bookings after seat selection
  - Cancel pending or confirmed bookings

- **Booking Management**
  - View all personal bookings
  - See booking status (PENDING, CONFIRMED, CANCELLED)
  - View booking details including seats and show information
  - Cancel bookings with automatic seat release

### Admin Features

- **Dashboard**
  - Overview statistics (shows, events, venues, users)
  - Quick access to all management sections
  - Visual cards with counts and links

- **Venue Management**
  - Create new venues with name and seat capacity
  - View all venues
  - View venue details

- **Event Management**
  - Create events associated with venues
  - Set event name and description
  - View all events
  - View event details

- **Show Management**
  - Create shows for events
  - Set show date, time, and pricing
  - View all shows with status filtering
  - View show details and status
  - Monitor show availability

- **User Management**
  - View all registered users
  - View user details
  - Paginated user list

- **Booking Management**
  - View all bookings across all users
  - Filter bookings by status
  - View detailed booking information
  - Monitor booking activity

- **Audit Logs**
  - View comprehensive audit logs
  - Filter by operation type (LOCK, BOOK, CANCEL, etc.)
  - Filter by outcome (SUCCESS, FAILURE)
  - Filter by show, user, or booking ID
  - View detailed log information

## Tech Stack

- **React 18** - Modern UI library with hooks
- **React Router 6** - Client-side routing and navigation
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API requests
- **Context API** - State management for authentication

## Getting Started

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- Backend API server running (see backend README)

### Installation

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Configure Environment Variables**

   Copy the example environment file:

   ```bash
   cp env.example .env
   ```

   Edit `.env` and set your API URL:

   ```env
   VITE_API_URL=http://localhost:3000
   VITE_PORT=5173
   ```

   - `VITE_API_URL`: Backend API base URL (default: `http://localhost:3000`)
   - `VITE_PORT`: Frontend dev server port (default: `5173`)

3. **Start Development Server**

   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5173` (or your configured port).

4. **Build for Production**

   ```bash
   npm run build
   ```

   The optimized production build will be in the `dist` directory.

## User Flow

### 1. Registration & Login

#### Registration Flow

1. Navigate to `/register`
2. Select account type (User or Admin)
3. Fill in registration form:
   - Full Name
   - Email address
   - Password
4. Submit registration
5. **Automatic login** after successful registration
6. Redirect based on account type:
   - **User** → Home page (`/`)
   - **Admin** → Admin Dashboard (`/admin`)

#### Login Flow

1. Navigate to `/login`
2. Select account type (User or Admin)
3. Enter email and password
4. Submit login
5. On success:
   - JWT token stored in HTTP-only cookie (secure)
   - User data stored in localStorage
   - User type stored in localStorage
   - Redirect based on account type:
     - **User** → Home page or previously requested page
     - **Admin** → Admin Dashboard

### 2. Browsing Shows (User)

1. **Home Page** (`/`)
   - View all available shows
   - Each show card displays:
     - Event name
     - Venue name
     - Show date and time
     - Available seats count
   - Click "View Details" to see more

2. **Shows Page** (`/shows`)
   - Browse all available shows
   - Filter and search functionality
   - Click on a show to view details

3. **Show Detail Page** (`/shows/:id`)
   - View complete show information:
     - Event details
     - Venue information
     - Date and time
     - Pricing
     - Total and available seats
   - Interactive seat map
   - Select seats for booking

### 3. Booking Process (User)

#### Step 1: Select Seats

1. On Show Detail page, view the seat map
2. Seats are color-coded:
   - **Green**: Available
   - **Red**: Booked
   - **Yellow**: Locked (by you or another user)
3. Click on available seats to select them
4. Selected seats are highlighted
5. Selection is saved in sessionStorage (persists on refresh)
6. Click "Proceed to Booking" button

#### Step 2: Lock Seats

1. If not logged in, redirect to login page
2. After login, redirect back to booking
3. System attempts to lock selected seats:
   - Creates temporary reservation (1 minute expiry)
   - Prevents other users from booking same seats
   - Returns booking ID if successful
4. On success → Redirect to confirmation page
5. On failure → Show error, clear selection, allow retry

#### Step 3: Confirm Booking

1. **Booking Confirmation Page** (`/booking/confirm`)
   - Review booking details:
     - Show information
     - Selected seats
     - Total price
   - Click "Confirm Booking" to finalize
   - Or click "Cancel" to release seats

2. **Confirmation Process**:
   - Booking status changes from PENDING to CONFIRMED
   - Seats are marked as BOOKED
   - Booking is saved permanently
   - Redirect to "My Bookings" page

#### Step 4: View Bookings

1. Navigate to "My Bookings" (`/bookings`)
2. View all personal bookings:
   - PENDING bookings (not yet confirmed)
   - CONFIRMED bookings (active)
   - CANCELLED bookings (if any)
3. Click on a booking to view details
4. Cancel bookings if needed

### 4. Cancellation Flow

1. From "My Bookings" page, click "Cancel" on a booking
2. **PENDING Bookings**:
   - Seats are immediately released
   - Booking record is deleted
   - Seats become available for others
3. **CONFIRMED Bookings**:
   - Seats are released
   - Booking status changes to CANCELLED
   - Booking record is preserved for audit
4. Confirmation message displayed

## Admin Flow

### 1. Admin Login

1. Navigate to `/login`
2. Select "Admin" account type
3. Enter admin credentials
4. On success → Redirect to Admin Dashboard (`/admin`)

### 2. Admin Dashboard

**Dashboard Overview** (`/admin`)

- View statistics:
  - Total Shows
  - Total Events
  - Total Venues
  - Total Users
- Quick access cards to:
  - Manage Venues
  - Manage Events
  - Manage Shows
  - View Users
  - View Bookings
  - View Audit Logs

### 3. Venue Management

**Create Venue** (`/admin/venues`)

1. Click "Create Venue" button
2. Fill in form:
   - Venue Name
   - Total Seat Capacity
3. Submit
4. Venue is created and appears in the list
5. View all venues in a paginated table

**View Venues**

- List all venues with:
  - Venue name
  - Seat capacity
  - Creation date
- Click on venue to view details

### 4. Event Management

**Create Event** (`/admin/events`)

1. Navigate to Events page (`/admin/events`)
2. Click "Create Event"
3. Fill in form:
   - Event Name
   - Description
   - Select Venue (from dropdown)
4. Submit
5. Event is created and associated with venue
6. View all events in a paginated table

**View Events**

- List all events with:
  - Event name
  - Associated venue
  - Description
  - Creation date
- Click on event to view details

### 5. Show Management

**Create Show** (`/admin/shows`)

1. Navigate to Shows page (`/admin/shows`)
2. Click "Create Show"
3. Fill in form:
   - Select Event (from dropdown)
   - Show Date
   - Show Time
   - Price per seat
4. Submit
5. Show is created
6. **Seat Generation**: Background worker automatically generates seats based on venue capacity
7. View all shows with status (AVAILABLE, SOLD_OUT, CANCELLED)

**View Shows**

- List all shows with:
  - Event name
  - Venue name
  - Date and time
  - Status
  - Available seats
- Filter by status
- Click on show to view details and status

### 6. User Management

**View Users** (`/admin/users`)

1. Navigate to Users page (`/admin/users`)
2. View paginated list of all registered users
3. Each user entry shows:
   - Name
   - Email
   - Registration date
4. Click on user to view detailed information

### 7. Booking Management

**View All Bookings** (`/admin/bookings`)

1. Navigate to Bookings page (`/admin/bookings`)
2. View all bookings across all users
3. Filter by booking status (PENDING, CONFIRMED, CANCELLED)
4. Each booking shows:
   - User information
   - Show details
   - Seat information
   - Booking status
   - Booking date
5. Click on booking to view full details

### 8. Audit Logs

**View Audit Logs** (`/admin/audit-logs`)

1. Navigate to Audit Logs page (`/admin/audit-logs`)
2. View comprehensive system activity logs
3. **Filter Options**:
   - By Operation Type: LOCK, BOOK, CANCEL, SHOW_CREATE, SEAT_GENERATE
   - By Outcome: SUCCESS, FAILURE
   - By Show ID
   - By User ID
   - By Booking ID
4. Each log entry shows:
   - Operation type
   - Outcome (success/failure)
   - Timestamp
   - Related IDs (user, booking, show, seat)
   - Error reason (if failure)
   - Metadata
5. Use filters to find specific logs
6. Paginated results for large datasets

## Authentication

### Authentication Mechanism

- **JWT Tokens**: Stored in HTTP-only cookies (secure, not accessible via JavaScript)
- **User Data**: Stored in localStorage (for UI state)
- **User Type**: Stored in localStorage (user/admin distinction)

### Authentication Flow

1. **Login Request**:
   ```
   POST /api/users/login or /api/admin/auth/login
   Body: { email, password }
   ```

2. **Response**:
   - JWT token set as HTTP-only cookie
   - User data returned in response body
   - Frontend stores user data in localStorage

3. **Subsequent Requests**:
   - Axios automatically includes cookies (withCredentials: true)
   - Backend validates JWT from cookie
   - No manual token handling needed

4. **Logout**:
   - Call logout endpoint (clears cookie on server)
   - Clear localStorage
   - Redirect to login page

### Protected Routes

- **Public Routes**: `/login`, `/register` (redirect if authenticated)
- **User Routes**: `/bookings`, `/booking/confirm` (require user authentication)
- **Admin Routes**: `/admin/*` (require admin authentication)
- **Public Content**: `/`, `/shows`, `/shows/:id` (accessible to all)

### Route Protection Logic

```javascript
// User routes
<PrivateRoute requireUser>
  <UserComponent />
</PrivateRoute>

// Admin routes
<PrivateRoute requireAdmin>
  <AdminComponent />
</PrivateRoute>

// Public routes (redirect if authenticated)
<PublicRoute>
  <Login />
</PublicRoute>
```

## Booking Process

### Detailed Booking Flow

#### 1. Seat Selection

- **Location**: Show Detail Page (`/shows/:id`)
- **Process**:
  1. Load show details and seat map
  2. Display seats with color coding:
     - Green: Available
     - Red: Booked
     - Yellow: Locked
  3. User clicks available seats
  4. Selected seats highlighted
  5. Selection saved to sessionStorage
  6. "Proceed to Booking" button enabled

#### 2. Authentication Check

- If user not logged in:
  - Redirect to `/login`
  - Store return path in location state
  - After login, redirect back to booking

#### 3. Lock Seats (with Queue)

- **API Call**: `POST /api/seats/lock`
- **Request Body**:
  ```json
  {
    "showId": "show-id",
    "seatIds": ["seat-1", "seat-2"]
  }
  ```
- **Process** (BookMyShow-style queue):
  1. User joins a per-show booking queue (Redis sorted set; position by timestamp).
  2. Only the first **1000** users in the queue are allowed to book at a time.
  3. If the user is in the batch: backend acquires Redis locks for seats, PostgreSQL row locks, marks seats LOCKED, creates PENDING booking, returns **200** with booking ID.
  4. If the user is not in the batch: backend returns **202** with `queued: true`, `queuePosition`, `totalInQueue`, `batchSize`. The frontend shows a "You're in the queue" screen and polls `GET /api/shows/:showId/queue/position` every 2.5s. When `inBatch` becomes true, the frontend retries the lock request; when lock returns 200, the user proceeds to confirmation.
- **Success (200)**: Redirect to confirmation page
- **Queued (202)**: Show queue position and wait; when it's their turn, lock is retried automatically
- **Failure**: Show error, clear selection, allow retry

#### 4. Confirm Booking

- **Location**: Booking Confirmation Page (`/booking/confirm`)
- **API Call**: `POST /api/bookings/:bookingId/confirm`
- **Process**:
  1. Validate booking is PENDING
  2. Change booking status to CONFIRMED
  3. Mark seats as BOOKED
  4. Release locks
  5. Return success
- **Success**: Redirect to "My Bookings"
- **Failure**: Show error, allow retry or cancel

#### 5. Cancel Booking

- **From**: My Bookings page or Booking Detail
- **API Call**: `POST /api/bookings/:bookingId/cancel`
- **Process**:
  - **PENDING**: Delete booking, release seats
  - **CONFIRMED**: Mark as CANCELLED, release seats
- **Result**: Seats become available, booking updated/deleted

### Seat Status Lifecycle

```
AVAILABLE → (User selects) → SELECTED → (Lock API) → LOCKED → (Confirm) → BOOKED
                                                              ↓
                                                         (Cancel) → AVAILABLE
```

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   └── Layout.jsx      # Main layout with navigation
│   │
│   ├── context/            # React Context providers
│   │   └── AuthContext.jsx # Authentication state management
│   │
│   ├── pages/              # Page components
│   │   ├── admin/          # Admin pages
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Venues.jsx
│   │   │   ├── Events.jsx
│   │   │   ├── Shows.jsx
│   │   │   ├── Users.jsx
│   │   │   ├── Bookings.jsx
│   │   │   └── AuditLogs.jsx
│   │   ├── Home.jsx        # Home page with shows list
│   │   ├── Login.jsx       # Login page
│   │   ├── Register.jsx    # Registration page
│   │   ├── Shows.jsx       # Shows listing page
│   │   ├── ShowDetail.jsx  # Show details and seat selection
│   │   ├── BookingConfirmation.jsx  # Booking confirmation
│   │   └── MyBookings.jsx  # User's bookings list
│   │
│   ├── services/           # API service layer
│   │   └── api.js         # Axios instance and API methods
│   │
│   ├── App.jsx            # Main app component with routing
│   ├── main.jsx           # Application entry point
│   └── index.css          # Global styles and Tailwind imports
│
├── index.html              # HTML template
├── package.json            # Dependencies and scripts
├── vite.config.js         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
├── env.example            # Environment variables example
└── .gitignore             # Git ignore rules
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_URL` | Backend API base URL | No | `http://localhost:3000` |
| `VITE_PORT` | Frontend dev server port | No | `5173` |

### Configuration

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:3000
VITE_PORT=5173
```

**Note**: Vite requires the `VITE_` prefix for environment variables to be exposed to the client code.

## API Integration

### API Service Layer

All API calls are centralized in `src/services/api.js`:

- **Axios Instance**: Pre-configured with base URL and credentials
- **Automatic Cookie Handling**: `withCredentials: true` for JWT cookies
- **Error Interceptors**: Handle 401 (unauthorized) and redirect to login
- **API Methods**: Organized by resource (userAPI, adminAPI, showAPI, etc.)

### API Endpoints Used

#### User Endpoints
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User login
- `POST /api/users/logout` - User logout
- `GET /api/users/me` - Get user profile
- `GET /api/bookings` - Get user bookings
- `GET /api/bookings/:id` - Get booking details
- `POST /api/seats/lock` - Lock seats (returns 202 with queue position if not in batch)
- `GET /api/shows/:showId/queue/position` - Get current queue position (authenticated)
- `POST /api/bookings/:id/confirm` - Confirm booking
- `POST /api/bookings/:id/cancel` - Cancel booking

#### Public Endpoints (No Authentication Required)
- `GET /api/shows` - Get available shows
- `GET /api/shows/:id` - Get show details
- `GET /api/shows/:id/seats` - Get show seats
- `GET /api/venues` - Get all venues
- `GET /api/venues/:id` - Get venue by ID
- `GET /api/events` - Get all events
- `GET /api/events/:id` - Get event by ID

#### Admin Endpoints (Admin Authentication Required)
- `POST /api/admin/auth/register` - Admin registration
- `POST /api/admin/auth/login` - Admin login
- `POST /api/admin/auth/logout` - Admin logout
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user by ID
- `POST /api/admin/venues` - Create venue (GET endpoints are public)
- `POST /api/admin/events` - Create event (GET endpoints are public)
- `POST /api/admin/shows` - Create show
- `GET /api/admin/shows` - Get all shows (admin view with status filter)
- `GET /api/admin/shows/:id/status` - Get show status
- `GET /api/admin/bookings` - Get all bookings
- `GET /api/admin/bookings/:id` - Get booking by ID
- `GET /api/admin/audit-logs` - Get audit logs

### Error Handling

- **401 Unauthorized**: Automatically redirects to login page
- **Network Errors**: Displayed to user with error messages
- **Validation Errors**: Shown in form with specific field errors
- **Rate Limiting**: Error message with retry information

## Responsive Design

The application is fully responsive and optimized for:

- **Desktop** (1024px+): Full layout with sidebar navigation
- **Tablet** (768px - 1023px): Adapted layout with collapsible navigation
- **Mobile** (< 768px): Stacked layout with mobile menu

### Design Features

- **Tailwind CSS**: Utility-first styling
- **Responsive Grid**: CSS Grid and Flexbox for layouts
- **Mobile-First**: Designed mobile-first, enhanced for larger screens
- **Touch-Friendly**: Large click targets for mobile devices
- **Loading States**: Skeleton loaders and spinners
- **Error States**: Clear error messages and retry options

## Key Features & Details

### Session Persistence

- **Selected Seats**: Saved in sessionStorage (cleared on browser close)
- **User Data**: Saved in localStorage (persists across sessions)
- **Authentication**: JWT in HTTP-only cookie (secure, automatic)

### Real-Time Updates

- **Seat Status**: Refreshed when viewing show details
- **Booking Status**: Updated immediately after actions
- **Error Handling**: Real-time validation and error messages

### User Experience

- **Auto-Login**: Automatic login after registration
- **Return Navigation**: Redirects back to intended page after login
- **Selection Persistence**: Seat selection survives page refreshes
- **Loading States**: Visual feedback during API calls
- **Error Messages**: Clear, actionable error messages
- **Success Feedback**: Confirmation messages for successful actions

### Security Features

- **HTTP-Only Cookies**: JWT tokens not accessible via JavaScript
- **Protected Routes**: Route guards prevent unauthorized access
- **Automatic Logout**: Redirects to login on 401 errors
- **CSRF Protection**: Cookies with SameSite attribute

### Performance

- **Code Splitting**: Route-based code splitting
- **Lazy Loading**: Components loaded on demand
- **Optimized Builds**: Vite production builds are optimized
- **Efficient Re-renders**: React hooks and context for state management

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Code Style

- **ES6+ JavaScript**: Modern JavaScript features
- **React Hooks**: Functional components with hooks
- **Component Structure**: Organized, reusable components
- **Error Boundaries**: Error handling at component level

## Troubleshooting

### Common Issues

1. **API Connection Errors**
   - Verify backend server is running
   - Check `VITE_API_URL` in `.env`
   - Ensure CORS is configured on backend

2. **Authentication Issues**
   - Clear localStorage and cookies
   - Verify JWT_SECRET matches backend
   - Check cookie settings in browser

3. **Seat Selection Not Working**
   - Check browser console for errors
   - Verify sessionStorage is enabled
   - Clear sessionStorage and retry

4. **Build Errors**
   - Clear `node_modules` and reinstall
   - Check Node.js version (v16+)
   - Verify all environment variables are set

## License

ISC
