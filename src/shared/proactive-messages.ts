export interface ProactiveMsg {
  /** local hour (0-23) lower bound, inclusive */
  fromHour: number
  /** local hour upper bound, exclusive */
  toHour: number
  text: string
}

/** First match wins. Picked by current local hour. */
export const PROACTIVE_MESSAGES: ProactiveMsg[] = [
  { fromHour: 6, toHour: 10, text: '小屿早上好呀，今天也要好好的 🌿' },
  { fromHour: 10, toHour: 12, text: '上午过半啦，记得喝口水 ☕' },
  { fromHour: 12, toHour: 14, text: '该吃午饭咯，别饿着自己。' },
  { fromHour: 14, toHour: 18, text: '下午容易困，要不要起来走两步？' },
  { fromHour: 18, toHour: 20, text: '忙了一天，晚饭吃了吗？' },
  { fromHour: 20, toHour: 23, text: '晚上啦，别太晚睡，眼睛也要休息 🌙' },
  { fromHour: 23, toHour: 24, text: '这么晚还没睡？我陪着你，但你也早点休息。' },
  { fromHour: 0, toHour: 6, text: '凌晨了，别熬了，明天还有明天的事。' },
]
