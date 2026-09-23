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
    // 被跳过（暂时隐藏）的食材 id 集合
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
      // 若该食材此前被跳过，完成打卡时顺带清除跳过状态
      this.skipped = this.skipped.filter((s) => s.ingredientId !== ingredientId)
      user.addPoints(CHALLENGE_POINTS)
      this.persist()
      this.persistSkipped()
      return record
    },

    // 暂时跳过：从候选列表隐藏，仅做标记，不改动库存数量，可随时恢复
    skip({ ingredientId, ingredientName }) {
      if (this.skippedIngredientIds.has(ingredientId)) return
      this.skipped.unshift({
        id: uid('sk'),
        ingredientId,
        ingredientName,
        date: new Date().toISOString(),
      })
      this.persistSkipped()
    },

    // 恢复被跳过的食材，重新出现在候选列表
    restore(ingredientId) {
      this.skipped = this.skipped.filter((s) => s.ingredientId !== ingredientId)
      this.persistSkipped()
    },
  },
})
