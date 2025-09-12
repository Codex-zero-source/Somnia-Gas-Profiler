<template>
  <div class="contracts">
    <div class="card">
      <div class="card-header">
        <h2>Profiled Contracts</h2>
      </div>
      <div class="search-bar">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search contracts by address..."
          class="search-input"
        />
        <button @click="searchContracts" class="btn">Search</button>
      </div>
      
      <table class="table">
        <thead>
          <tr>
            <th>Contract Address</th>
            <th>Functions</th>
            <th>Avg Gas</th>
            <th>Min Gas</th>
            <th>Max Gas</th>
            <th>Last Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="contract in filteredContracts" :key="contract.address">
            <td>{{ contract.address }}</td>
            <td>{{ contract.functions }}</td>
            <td>{{ contract.avgGas }}</td>
            <td>{{ contract.minGas }}</td>
            <td>{{ contract.maxGas }}</td>
            <td>{{ contract.lastUpdated }}</td>
            <td>
              <button @click="viewDetails(contract)" class="btn">View Details</button>
            </td>
          </tr>
          <tr v-if="filteredContracts.length === 0">
            <td colspan="7" style="text-align: center;">No contracts found</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

export default {
  name: 'ContractsView',
  setup() {
    const contracts = ref([])
    const searchQuery = ref('')
    
    // Mock data for contracts
    const loadContracts = () => {
      contracts.value = [
        {
          address: '0x742d35Cc6634C0532925a3b8D6c6C0c1f528d15',
          functions: 8,
          avgGas: 38250,
          minGas: 21000,
          maxGas: 65432,
          lastUpdated: '2023-10-15 14:30:22'
        },
        {
          address: '0xA0b86a33E6441b4aC029B3a0a8efb0bb8f2EaBFc',
          functions: 12,
          avgGas: 62100,
          minGas: 25000,
          maxGas: 187500,
          lastUpdated: '2023-10-14 09:15:47'
        },
        {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          functions: 6,
          avgGas: 29800,
          minGas: 21000,
          maxGas: 45200,
          lastUpdated: '2023-10-13 16:42:11'
        },
        {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          functions: 15,
          avgGas: 87500,
          minGas: 21000,
          maxGas: 215000,
          lastUpdated: '2023-10-12 11:20:33'
        }
      ]
    }
    
    const filteredContracts = computed(() => {
      if (!searchQuery.value) {
        return contracts.value
      }
      
      return contracts.value.filter(contract => 
        contract.address.toLowerCase().includes(searchQuery.value.toLowerCase())
      )
    })
    
    const searchContracts = () => {
      // In a real implementation, this would search in Redis
      console.log('Searching for:', searchQuery.value)
    }
    
    const viewDetails = (contract) => {
      // In a real implementation, this would navigate to contract details
      alert(`Viewing details for contract: ${contract.address}`)
    }
    
    onMounted(() => {
      loadContracts()
    })
    
    return {
      contracts,
      searchQuery,
      filteredContracts,
      searchContracts,
      viewDetails
    }
  }
}
</script>

<style scoped>
.search-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}
</style>