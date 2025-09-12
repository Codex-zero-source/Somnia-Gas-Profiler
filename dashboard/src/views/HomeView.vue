<template>
  <div class="home">
    <div class="card">
      <div class="card-header">
        <h2>Dashboard Overview</h2>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Contracts</div>
          <div class="stat-value">{{ stats.totalContracts || 0 }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Functions</div>
          <div class="stat-value">{{ stats.totalFunctions || 0 }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Gas Usage</div>
          <div class="stat-value">{{ stats.avgGasUsage || 0 }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Highest Gas Usage</div>
          <div class="stat-value">{{ stats.highestGasUsage || 0 }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Recent Contracts</h2>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Contract Address</th>
            <th>Functions Profiled</th>
            <th>Avg Gas</th>
            <th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="contract in recentContracts" :key="contract.address">
            <td>{{ contract.address }}</td>
            <td>{{ contract.functions }}</td>
            <td>{{ contract.avgGas }}</td>
            <td>{{ contract.lastUpdated }}</td>
          </tr>
          <tr v-if="recentContracts.length === 0">
            <td colspan="4" style="text-align: center;">No contracts found</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import axios from 'axios'

export default {
  name: 'HomeView',
  setup() {
    const stats = ref({
      totalContracts: 0,
      totalFunctions: 0,
      avgGasUsage: 0,
      highestGasUsage: 0
    })
    
    const recentContracts = ref([])
    
    const fetchDashboardData = async () => {
      try {
        // In a real implementation, this would connect to Redis
        // For now, we'll use mock data
        stats.value = {
          totalContracts: 24,
          totalFunctions: 142,
          avgGasUsage: 42500,
          highestGasUsage: 187500
        }
        
        recentContracts.value = [
          {
            address: '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
            functions: 8,
            avgGas: 38250,
            lastUpdated: '2023-10-15 14:30:22'
          },
          {
            address: '0xA0b86a33E6441b4aC029B3a0a8efb0bb8f2EaBFc',
            functions: 12,
            avgGas: 62100,
            lastUpdated: '2023-10-14 09:15:47'
          },
          {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            functions: 6,
            avgGas: 29800,
            lastUpdated: '2023-10-13 16:42:11'
          }
        ]
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      }
    }
    
    onMounted(() => {
      fetchDashboardData()
    })
    
    return {
      stats,
      recentContracts
    }
  }
}
</script>