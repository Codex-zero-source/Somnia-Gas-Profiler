import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ContractsView from '../views/ContractsView.vue'
import AnalyticsView from '../views/AnalyticsView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/contracts',
    name: 'contracts',
    component: ContractsView
  },
  {
    path: '/analytics',
    name: 'analytics',
    component: AnalyticsView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router