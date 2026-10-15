import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import RoomView from '../views/RoomView.vue';
import NotFound from '../views/NotFound.vue';
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/sala/:code', component: RoomView },
    { path: '/:pathMatch(.*)*', component: NotFound },
  ],
});
