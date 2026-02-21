# Event Booking System - Frontend

A beautiful, responsive React frontend for the Event Booking System.

## Features

- **User Features:**
  - Browse available shows
  - View show details and seat availability
  - Select and lock seats
  - Confirm or cancel bookings
  - View booking history

- **Admin Features:**
  - Dashboard with statistics
  - Manage venues
  - Manage events
  - Manage shows
  - View all users
  - View audit logs

## Tech Stack

- React 18
- React Router 6
- Vite
- Tailwind CSS
- Axios

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (optional, defaults to `http://localhost:3000`):
```env
VITE_API_URL=http://localhost:3000
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable components
│   ├── context/         # React context (Auth)
│   ├── pages/           # Page components
│   │   ├── admin/       # Admin pages
│   │   └── ...          # User pages
│   ├── services/        # API service layer
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Usage

### User Flow

1. Register/Login as a user
2. Browse shows on the home page
3. Click on a show to view details
4. Select seats and lock them
5. Confirm the booking
6. View bookings in "My Bookings"

### Admin Flow

1. Register/Login as an admin
2. Access the admin dashboard
3. Create venues, events, and shows
4. View users and audit logs

## Responsive Design

The frontend is fully responsive and works on:
- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (< 768px)

## API Integration

The frontend communicates with the backend API at the base URL specified in `VITE_API_URL` or defaults to `http://localhost:3000`.

All API calls are handled through the service layer in `src/services/api.js`.

