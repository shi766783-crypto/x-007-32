<script setup>
import { reactive, computed } from 'vue'
import { useInventoryStore } from '@/stores/inventory'
import { useChallengeStore } from '@/stores/challenge'
import { useMealPlanStore } from '@/stores/mealPlan'
import { useUserStore } from '@/stores/user'
import { CHALLENGE_POINTS } from '@/constants'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseEmpty from '@/components/common/BaseEmpty.vue'
import { expiryDateKey } from '@/utils/date'

const inventory = useInventoryStore()
const challenge = useChallengeStore()
const mealPlan = useMealPlanStore()
const user = useUserStore()

// 每个食材对应的“要做的菜”输入（动态 key，需用 reactive）
const pickedDish = reactive({})

// 可挑战食材 = 临期 + 过期（含被跳过的，用于恢复区匹配真实库存）
const rawCandidates = computed(() =>
  [...inventory.nearExpiryItems, ...inventory.expiredItems].sort((a, b) => a.remain - b.remain),
)

// 候选列表中隐藏已跳过的食材
const candidates = computed(() =>
  rawCandidates.value.filter((item) => !challenge.skippedIngredientIds.has(item.id)),
)

// 已跳过且仍在库存里属于临期/过期的食材，附带最新的保质期信息
const skippedItems = computed(() =>
  challenge.skipped
    .map((s) => {
      const live = rawCandidates.value.find((i) => i.id === s.ingredientId)
      // s 只含 id/ingredientId/ingredientName/date，name、数量等仍取自实时库存
      return live ? { ...live, ...s } : null
    })
    .filter(Boolean),
)

const allHidden = computed(
  () => !candidates.value.length && rawCandidates.value.length > 0,
)

function complete(item) {
  const dishName = pickedDish[item.id]
  if (!dishName || !dishName.trim()) {
    alert('请先选择或输入要做的菜')
    return
  }
  challenge.complete({
    ingredientId: item.id,
    ingredientName: item.name,
    dishName: dishName.trim(),
  })
  delete pickedDish[item.id]
}

// 暂时跳过：只在挑战页隐藏，不影响库存数量
function skip(item) {
  challenge.skip({ ingredientId: item.id, ingredientName: item.name })
  delete pickedDish[item.id]
}

function restore(s) {
  challenge.undoskip(s.ingredientId)
}

function fmt(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
</script>

<template>
  <div>
    <div class="page-head">
      <h2>🧹 冰箱清理挑战</h2>
      <span class="points-chip">⭐ 当前积分 {{ user.points }}</span>
    </div>

    <p class="muted">选择临期/过期食材，做一道菜吃掉它，完成后打卡获得 <b>{{ CHALLENGE_POINTS }} 积分</b>！</p>

    <BaseEmpty v-if="!rawCandidates.length" emoji="🧊" text="没有需要清理的临期/过期食材，冰箱很干净！" />
    <BaseEmpty v-else-if="allHidden" emoji="🙈" text="当前待清理的食材都已暂时跳过，可在下方恢复" />

    <div v-else class="grid grid-2">
      <div v-for="item in candidates" :key="item.id" class="challenge card">
        <div class="ch-head">
          <span class="emoji">🍲</span>
          <div class="info">
            <div class="name">{{ item.name }}</div>
            <div class="muted small">
              {{ item.quantity }}{{ item.unit }} · 过期日 {{ expiryDateKey(item.purchaseDate, item.shelfLifeDays) }}
              ·
              <span :style="{ color: item.status === 'expired' ? '#ef5350' : '#ff9800' }">
                {{ item.status === 'expired' ? `已过期 ${Math.abs(item.remain)} 天` : `剩 ${item.remain} 天` }}
              </span>
            </div>
          </div>
        </div>

        <template v-if="!challenge.completedIngredientIds.has(item.id)">
          <div class="dish-pick">
            <select v-model="pickedDish[item.id]">
              <option value="">选择要做的菜…</option>
              <option v-for="d in mealPlan.dishes" :key="d.id" :value="d.name">{{ d.name }}</option>
            </select>
            <input v-model="pickedDish[item.id]" type="text" placeholder="或输入新菜名" />
          </div>
          <BaseButton block @click="complete(item)">✅ 完成打卡 +{{ CHALLENGE_POINTS }}积分</BaseButton>
          <BaseButton block variant="ghost" @click="skip(item)">⏭️ 暂时跳过</BaseButton>
        </template>
        <div v-else class="done">🎉 已清理</div>
      </div>
    </div>

    <div v-if="skippedItems.length" class="card">
      <div class="section-title">已跳过（{{ skippedItems.length }}）</div>
      <p class="muted small skip-tip">这些食材已从候选列表中隐藏，库存数量不受影响，随时可以恢复处理。</p>
      <div class="records">
        <div v-for="s in skippedItems" :key="s.id" class="rec">
          <span>
            ⏭️ {{ s.name }}
            <span class="muted small">
              · {{ s.quantity }}{{ s.unit }}
              · 跳过于 {{ fmt(s.date) }}
            </span>
          </span>
          <BaseButton size="sm" variant="ghost" @click="restore(s)">↩️ 恢复</BaseButton>
        </div>
      </div>
    </div>

    <div v-if="challenge.completed.length" class="card">
      <div class="section-title">清理记录</div>
      <div class="records">
        <div v-for="c in challenge.completed" :key="c.id" class="rec">
          <span>🧹 {{ c.ingredientName }} → 做了「{{ c.dishName }}」</span>
          <span class="muted small">{{ fmt(c.date) }} · +{{ c.points }}积分</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.page-head h2 {
  margin: 0;
}
.points-chip {
  background: var(--warn-light);
  color: var(--warn);
  padding: 6px 14px;
  border-radius: 20px;
  font-weight: 600;
}
.challenge {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ch-head {
  display: flex;
  gap: 12px;
  align-items: center;
}
.ch-head .emoji {
  font-size: 32px;
}
.info .name {
  font-weight: 600;
}
.small {
  font-size: 12px;
}
.dish-pick {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dish-pick select,
.dish-pick input {
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
}
.done {
  text-align: center;
  padding: 12px;
  background: var(--primary-light);
  border-radius: 8px;
  font-weight: 600;
  color: var(--primary-dark);
}
.skip-tip {
  margin: 6px 0 10px;
}
.records {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rec {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.rec:last-child {
  border-bottom: none;
}
</style>
