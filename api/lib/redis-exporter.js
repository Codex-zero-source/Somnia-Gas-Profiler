const fs = require('fs').promises
const path = require('path')
const { createClient } = require('redis')

/**
 * Redis Exporter for Somnia Gas Profiler
 * Exports profiling results to Redis for dashboard visualization
 */
class RedisExporter {
  constructor(redisUrl) {
    this.redisUrl = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379'
    this.client = null
  }

  async connect() {
    try {
      this.client = createClient({
        url: this.redisUrl
      })

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err)
      })

      await this.client.connect()
      console.log('✅ Connected to Redis successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error.message)
      return false
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit()
      console.log('Disconnected from Redis')
    }
  }

  async exportResults(filePath) {
    try {
      // Read profiling results
      const content = await fs.readFile(filePath, 'utf8')
      const results = JSON.parse(content)
      
      // Store contract data
      const contractAddress = results.address
      await this.client.set(`contract:${contractAddress}`, JSON.stringify(results))
      await this.client.set(`contract:${contractAddress}:last_updated`, Date.now())
      
      console.log(`✅ Exported contract data for ${contractAddress} to Redis`)
      
      // Update dashboard statistics
      await this.updateDashboardStats(results)
      
      return true
    } catch (error) {
      console.error('❌ Failed to export results to Redis:', error.message)
      return false
    }
  }

  async updateDashboardStats(results) {
    try {
      // Get existing stats or initialize new ones
      let stats = await this.client.get('dashboard:stats')
      stats = stats ? JSON.parse(stats) : {
        totalContracts: 0,
        totalFunctions: 0,
        totalGasConsumed: 0,
        lastUpdated: Date.now()
      }
      
      // Update stats
      stats.totalContracts += 1
      stats.totalFunctions += Object.keys(results.results).length
      
      // Calculate total gas consumed
      let contractGasConsumed = 0
      for (const funcResult of Object.values(results.results)) {
        contractGasConsumed += funcResult.aggregated.total
      }
      stats.totalGasConsumed += contractGasConsumed
      
      stats.lastUpdated = Date.now()
      
      // Store updated stats
      await this.client.set('dashboard:stats', JSON.stringify(stats))
      
      console.log('✅ Updated dashboard statistics')
    } catch (error) {
      console.error('❌ Failed to update dashboard stats:', error.message)
    }
  }

  async exportAllResults(directoryPath) {
    try {
      const files = await fs.readdir(directoryPath)
      const jsonFiles = files.filter(file => path.extname(file) === '.json')
      
      console.log(`Found ${jsonFiles.length} JSON files to export`)
      
      for (const file of jsonFiles) {
        const filePath = path.join(directoryPath, file)
        console.log(`Exporting ${file}...`)
        await this.exportResults(filePath)
      }
      
      console.log('✅ All files exported successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to export all results:', error.message)
      return false
    }
  }
}

module.exports = {
  RedisExporter
}