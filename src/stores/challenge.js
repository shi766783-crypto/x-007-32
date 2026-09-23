import { defineStore } from 'pinia'
import { read, write } from '@/utils/storage'
import { uid } from '@/utils/id'
import { useUserStore } from './user'
import { CHALLENGE_POINTS } from '@/constants'

const KEY = 'challenges'
const SKIPPED_KEY = 'challenge-skipped'

export const useChallengeStore = defineStore('challenge', {
  state: () => ({
    completed: read(KEY, []), // [{ id, ingredientId, ingredientName, dishName, points, date }]
    skipped: read(SKIPPED_KEY, []), // [{ id, ingredientId, ingredientName, date }]
  }),

  getters: {
    challengeCount: (state) => state.completed.length,
    // 已完成挑战的食材 id 集合（用于判断是否还能挑战）
    completedIngredientIds() {
      return new Set(this.completed.map((c) => c.ingredientId))
    },
    // 已跳过的食材 id 集合（候选列表中隐藏这些食材）
    skippedIngredientIds() {
      return new Set(this.skipped.map((s) => s.ingredientId))
    },
  },

  actions: {
    persist() {
      write(KEY, this.completed)
    },

    persistSkipped() {
      write(SKIPPED_KEY, this.skipped)
    },

    complete({ ingredientId, ingredientName, dishName }) {
      const user = useUserStore()
      const record = {
        id: uid('ch'),
        ingredientId,
        ingredientName,
        dishName,
        points: CHALLENGE_POINTS,
        date: new Date().toISOString(),
      }
      this.completed.unshift(record)
      // 完成的食材若之前被跳过，顺手解除跳过状态（会自行持久化）
      this.undoskip(ingredientId)
      user.addPoints(CHALLENGE_POINTS)
      this.persist()
      return record
    },

    // 暂时跳过：仅在挑战页隐藏，不改动库存数量
    skip({ ingredientId, ingredientName }) {
      if (this.skippedIngredientIds.has(ingredientId)) return
      this.skipped.unshift({
        id: uid('skip'),
        ingredientId,
        ingredientName,
        date: new Date().toISOString(),
      })
      this.persistSkipped()
    },

    // 恢复跳过的食材，重新出现在候选列表
    undoskip(ingredientId) {
      const before = this.skipped.length
      this.skipped = this.skipped.filter((s) => s.ingredientId !== ingredientId)
      if (this.skipped.length !== before) this.persistSkipped()
    },
  },
})
