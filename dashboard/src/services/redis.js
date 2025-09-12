// Redis service for connecting to Redis database
import { createClient } from 'redis'

class RedisService {
  constructor() {
    // Default Redis configuration
    this.client = null
    this.isConnected = false
  }

  async connect(redisUrl = process.env.REDIS_URL || 'redis://localhost:6379') {
    try {
      this.client = createClient({
        url: redisUrl
      })

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err)
        this.isConnected = false
      })

      await this.client.connect()
      this.isConnected = true
      console.log('Connected to Redis successfully')
      return true
    } catch (error) {
      console.error('Failed to connect to Redis:', error)
      this.isConnected = false
      return false
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit()
      this.isConnected = false
      console.log('Disconnected from Redis')
    }
  }

  async getContractData(address) {
    if (!this.isConnected) {
      throw new Error('Not connected to Redis')
    }

    try {
      const data = await this.client.get(`contract:${address}`)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error(`Error fetching data for contract ${address}:`, error)
      return null
    }
  }

  async getAllContracts() {
    if (!this.isConnected) {
      throw new Error('Not connected to Redis')
    }

    try {
      // Get all contract keys
      const keys = await this.client.keys('contract:*')
      const contracts = []

      // Fetch data for each contract
      for (const key of keys) {
        const data = await this.client.get(key)
        if (data) {
          contracts.push(JSON.parse(data))
        }
      }

      return contracts
    } catch (error) {
      console.error('Error fetching all contracts:', error)
      return []
    }
  }

  async getDashboardStats() {
    if (!this.isConnected) {
      throw new Error('Not connected to Redis')
    }

    try {
      // Get dashboard statistics
      const stats = await this.client.get('dashboard:stats')
      return stats ? JSON.parse(stats) : null
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      return null
    }
  }

  async storeContractData(address, data) {
    if (!this.isConnected) {
      throw new Error('Not connected to Redis')
    }

    try {
      await this.client.set(`contract:${address}`, JSON.stringify(data))
      await this.client.set(`contract:${address}:last_updated`, Date.now())
      return true
    } catch (error) {
      console.error(`Error storing data for contract ${address}:`, error)
      return false
    }
  }

  async getContractAddresses() {
    if (!this.isConnected) {
      throw new Error('Not connected to Redis')
    }

    try {
      const keys = await this.client.keys('contract:*')
      return keys.map(key => key.replace('contract:', ''))
    } catch (error) {
      console.error('Error fetching contract addresses:', error)
      return []
    }
  }
}

// Export singleton instance
export default new RedisService()