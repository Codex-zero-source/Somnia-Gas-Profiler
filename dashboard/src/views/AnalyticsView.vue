<template>
  <div class="analytics">
    <div class="card">
      <div class="card-header">
        <h2>Gas Usage Analytics</h2>
      </div>
      
      <div class="chart-container">
        <div class="chart-placeholder">
          <p>Gas Usage Distribution Chart</p>
          <p>(Chart implementation would go here)</p>
        </div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Low Gas Functions (&lt;30K)</div>
          <div class="stat-value">24</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Medium Gas Functions (30K-100K)</div>
          <div class="stat-value">86</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">High Gas Functions (&gt;100K)</div>
          <div class="stat-value">32</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h2>Top Gas Consuming Functions</h2>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Function Signature</th>
            <th>Contract Address</th>
            <th>Avg Gas</th>
            <th>Min Gas</th>
            <th>Max Gas</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>swapExactTokensForTokens(...)</td>
            <td>0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D</td>
            <td>187,500</td>
            <td>125,200</td>
            <td>215,000</td>
          </tr>
          <tr>
            <td>mint(...)</td>
            <td>0x06012c8cf97BEaD5deAe237070F9587f8E7A266d</td>
            <td>156,800</td>
            <td>98,500</td>
            <td>187,200</td>
          </tr>
          <tr>
            <td>transferFrom(...)</td>
            <td>0xA0b86a33E6441b4aC029B3a0a8efb0bb8f2EaBFc</td>
            <td>98,600</td>
            <td>65,400</td>
            <td>125,800</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AnalyticsView'
}
</script>

<style scoped>
.chart-container {
  margin: 1.5rem 0;
  text-align: center;
}

.chart-placeholder {
  background: #f8f9fa;
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 3rem;
  color: #7f8c8d;
}

.chart-placeholder p:first-child {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
</style>