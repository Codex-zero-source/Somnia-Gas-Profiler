<template>
  <div id="app">
    <header class="header">
      <div class="container">
        <h1>Somnia Gas Profiler Dashboard</h1>
        <nav class="nav">
          <router-link to="/">Home</router-link>
          <router-link to="/contracts">Contracts</router-link>
          <router-link to="/analytics">Analytics</router-link>
        </nav>
      </div>
    </header>
    <main class="main">
      <div class="container">
        <router-view />
      </div>
    </main>
    <footer class="footer">
      <div class="container">
        <p>&copy; 2023 Somnia Gas Profiler. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', sans-serif;
  background-color: #f5f7fa;
  color: #333;
  line-height: 1.6;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header h1 {
  font-size: 1.8rem;
  font-weight: 600;
}

.nav {
  margin-top: 1rem;
}

.nav a {
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  margin-right: 1.5rem;
  font-weight: 500;
  transition: color 0.3s;
}

.nav a:hover,
.nav a.router-link-exact-active {
  color: white;
}

.main {
  min-height: calc(100vh - 160px);
  padding: 2rem 0;
}

.footer {
  background-color: #2c3e50;
  color: white;
  text-align: center;
  padding: 1.5rem 0;
  font-size: 0.9rem;
}

.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.card-header {
  border-bottom: 1px solid #eee;
  padding-bottom: 1rem;
  margin-bottom: 1rem;
}

.card-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
}

.btn {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.table th,
.table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.table tr:hover {
  background-color: #f5f7fa;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin: 1.5rem 0;
}

.stat-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #667eea;
  margin: 0.5rem 0;
}

.stat-label {
  color: #7f8c8d;
  font-size: 0.9rem;
}
</style>