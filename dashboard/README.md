# Somnia Gas Profiler Dashboard

A frontend dashboard for visualizing gas profiling data stored in Redis from the Somnia Gas Profiler.

## Features

- Dashboard overview with key metrics
- List of profiled contracts with search functionality
- Detailed analytics and gas usage charts
- Redis integration for real-time data access

## Prerequisites

- Node.js (v16 or higher)
- Redis server
- Somnia Gas Profiler data stored in Redis

## Installation

1. Navigate to the dashboard directory:
```bash
cd dashboard
```

2. Install dependencies:
```bash
npm install
```

## Configuration

Create a `.env` file in the dashboard directory with your Redis configuration:
```env
REDIS_URL=redis://localhost:6379
```

## Usage

### Development

To run the dashboard in development mode:
```bash
npm run dev
```

The dashboard will be available at http://localhost:3000

### Production

To build the dashboard for production:
```bash
npm run build
```

To preview the production build:
```bash
npm run preview
```

## Project Structure

```
dashboard/
├── src/
│   ├── components/     # Vue components
│   ├── views/          # Page views
│   ├── services/       # Service files (Redis connection)
│   ├── router/         # Router configuration
│   ├── App.vue         # Main App component
│   └── main.js         # Entry point
├── public/             # Static assets
├── index.html          # Main HTML file
├── vite.config.js      # Vite configuration
└── package.json        # Project dependencies
```

## Integration with Somnia Gas Profiler

The dashboard expects profiling data to be stored in Redis with the following structure:

- `contract:{address}` - Contract profiling data
- `dashboard:stats` - Dashboard statistics

To populate Redis with profiling data, run the Somnia Gas Profiler with Redis export enabled:
```bash
somnia-gas-profiler profile --address 0x... --export-redis
```

## Technologies Used

- Vue 3
- Vue Router
- Vite
- Redis client for Node.js
- Axios for HTTP requests

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License.