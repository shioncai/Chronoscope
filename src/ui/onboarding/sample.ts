import type { Category, EventRecord, Tag } from '../../domain/model'
import { fromAgo, fromCivil, fromYear, withFuzz, type TimePoint } from '../../domain/time'
import type { Locale } from '../../domain/locale'
import type { TransferFile } from '../../state'

/**
 * A small timeline that shows off what the app is for: thirteen billion years
 * and this afternoon on one axis. It imports through the ordinary merge, so
 * loading it twice changes nothing, and undo takes it away again in one step.
 */

type L = Record<Locale, string>
interface SampleEvent {
  id: string
  title: L
  note?: L
  folder: string
  tags?: string[]
  start?: TimePoint
  end?: TimePoint
  links?: string[]
}

const FOLDERS: { id: string; name: L; color: string }[] = [
  { id: 'cosmos', name: { zh: '宇宙', en: 'Cosmos' }, color: '#2980b9' },
  { id: 'life', name: { zh: '地球与生命', en: 'Earth & life' }, color: '#27ae60' },
  { id: 'history', name: { zh: '人类文明', en: 'Civilisation' }, color: '#e67e22' },
  { id: 'modern', name: { zh: '近现代', en: 'Modern era' }, color: '#8e44ad' },
  { id: 'me', name: { zh: '我的生活', en: 'My life' }, color: '#d6336c' },
]

const TAGS: { id: string; name: L }[] = [
  { id: 'milestone', name: { zh: '里程碑', en: 'milestone' } },
  { id: 'science', name: { zh: '科学', en: 'science' } },
  { id: 'extinction', name: { zh: '大灭绝', en: 'extinction' } },
]

const fuzz = (tp: TimePoint, years: number) => withFuzz(tp, { before: years, after: years })

function events(now: Date): SampleEvent[] {
  const today = { y: now.getFullYear(), mo: now.getMonth() + 1, d: now.getDate() }
  return [
    {
      id: 'big-bang', folder: 'cosmos', tags: ['milestone', 'science'],
      title: { zh: '宇宙大爆炸', en: 'The Big Bang' },
      note: { zh: '时间、空间与物质的**起点**。', en: 'The **beginning** of time, space and matter.' },
      start: fuzz(fromAgo(13.8e9, 'Ga'), 2e7),
    },
    {
      id: 'first-stars', folder: 'cosmos',
      title: { zh: '第一代恒星点亮', en: 'The first stars ignite' },
      start: fuzz(fromAgo(13.6e9, 'Ga'), 1e8),
    },
    {
      id: 'solar-system', folder: 'cosmos', links: ['earth'],
      title: { zh: '太阳系形成', en: 'The Solar System forms' },
      start: fromAgo(4.6e9, 'Ga'),
    },
    {
      id: 'earth', folder: 'life', tags: ['milestone'], links: ['solar-system'],
      title: { zh: '地球形成', en: 'Earth forms' },
      note: { zh: '由太阳星云吸积而成，误差约 ±5000 万年。', en: 'Accreted from the solar nebula, give or take 50 million years.' },
      start: fuzz(fromAgo(4.54e9, 'Ga'), 5e7),
    },
    {
      id: 'first-life', folder: 'life', tags: ['science'],
      title: { zh: '最早的生命', en: 'Earliest evidence of life' },
      start: fuzz(fromAgo(3.7e9, 'Ga'), 2e8),
    },
    {
      id: 'oxygen', folder: 'life',
      title: { zh: '大氧化事件', en: 'The Great Oxidation Event' },
      note: { zh: '蓝藻光合作用让大气第一次有了游离氧。', en: 'Photosynthesising cyanobacteria put free oxygen into the air.' },
      start: fromAgo(2.4e9, 'Ga'), end: fromAgo(2.0e9, 'Ga'),
    },
    {
      id: 'cambrian', folder: 'life', tags: ['milestone'],
      title: { zh: '寒武纪', en: 'The Cambrian period' },
      note: { zh: '多细胞动物门类在地质的一瞬间集中出现：\n\n- 三叶虫\n- 最早的脊索动物', en: 'Most animal phyla appear in a geological instant:\n\n- trilobites\n- the first chordates' },
      start: fromAgo(538.8e6, 'Ma'), end: fromAgo(485.4e6, 'Ma'),
    },
    {
      id: 'dinosaurs', folder: 'life', links: ['kpg'],
      title: { zh: '恐龙时代', en: 'The age of dinosaurs' },
      start: fromAgo(233e6, 'Ma'), end: fromAgo(66e6, 'Ma'),
    },
    {
      id: 'kpg', folder: 'life', tags: ['extinction'], links: ['dinosaurs'],
      title: { zh: '白垩纪末大灭绝', en: 'The K–Pg extinction' },
      note: { zh: '一颗小行星撞击希克苏鲁伯，非鸟恐龙灭绝。', en: 'An asteroid strikes Chicxulub; the non-avian dinosaurs die out.' },
      start: fromAgo(66e6, 'Ma'),
    },
    {
      id: 'sapiens', folder: 'life', tags: ['milestone'],
      title: { zh: '智人出现', en: 'Homo sapiens appears' },
      start: fuzz(fromAgo(300e3, 'ka'), 3e4),
    },
    {
      id: 'farming', folder: 'history',
      title: { zh: '农业起源', en: 'Farming begins' },
      start: fromAgo(12e3, 'ka'),
    },
    {
      id: 'pyramid', folder: 'history',
      title: { zh: '胡夫金字塔建成', en: 'The Great Pyramid of Giza' },
      start: fuzz(fromYear(-2559, 'year'), 10),
    },
    {
      id: 'qin', folder: 'history', tags: ['milestone'],
      title: { zh: '秦统一六国', en: 'Qin unifies China' },
      start: fromYear(-220, 'year'),
    },
    {
      id: 'rome', folder: 'history',
      title: { zh: '罗马帝国', en: 'The Roman Empire' },
      start: fromYear(-26, 'year'), end: fromYear(476, 'year'),
    },
    {
      id: 'tang', folder: 'history',
      title: { zh: '唐朝', en: 'The Tang dynasty' },
      start: fromYear(618, 'year'), end: fromYear(907, 'year'),
    },
    {
      id: 'printing', folder: 'history', tags: ['science'],
      title: { zh: '古登堡印刷机', en: "Gutenberg's printing press" },
      start: fuzz(fromYear(1440, 'year'), 5),
    },
    {
      id: 'industrial', folder: 'modern',
      title: { zh: '工业革命', en: 'The Industrial Revolution' },
      start: fromYear(1760, 'year'), end: fromYear(1840, 'year'),
    },
    {
      id: 'moon', folder: 'modern', tags: ['milestone', 'science'],
      title: { zh: '阿波罗 11 号登月', en: 'Apollo 11 lands on the Moon' },
      note: { zh: '[NASA 档案](https://www.nasa.gov/mission/apollo-11/)', en: '[NASA archive](https://www.nasa.gov/mission/apollo-11/)' },
      start: fromCivil({ y: 1969, mo: 7, d: 20, h: 20, mi: 17 }, 'minute'),
    },
    {
      id: 'web', folder: 'modern', tags: ['science'],
      title: { zh: '万维网向公众开放', en: 'The World Wide Web goes public' },
      start: fromCivil({ y: 1991, mo: 8, d: 6 }, 'day'),
    },
    {
      id: 'chronoscope', folder: 'me',
      title: { zh: '开始使用 Chronoscope', en: 'Started using Chronoscope' },
      note: {
        zh: '试试**对数轴**（时间轴工具栏，或按 L）——宇宙的起点和今天下午会同时出现在一屏里。',
        en: 'Try the **log axis** (timeline toolbar, or press L) — the start of the universe and this afternoon fit on one screen.',
      },
      start: fromCivil({ ...today, h: now.getHours(), mi: now.getMinutes() }, 'minute'),
    },
    {
      id: 'tea', folder: 'me',
      title: { zh: '下午茶', en: 'Afternoon tea' },
      start: fromCivil({ ...today, h: 15, mi: 0 }, 'minute'),
      end: fromCivil({ ...today, h: 15, mi: 30 }, 'minute'),
    },
  ]
}

export function buildSampleFile(locale: Locale, now: Date): TransferFile {
  const stamp = 'sample'
  const categories: Category[] = FOLDERS.map((f, i) => ({
    id: `sample-${f.id}`, name: f.name[locale], parentId: null, color: f.color, order: 1000 + i, updatedAt: stamp, deleted: false,
  }))
  const tags: Tag[] = TAGS.map((t) => ({ id: `sample-${t.id}`, name: t.name[locale], color: '#888888', updatedAt: stamp, deleted: false }))
  const evs: EventRecord[] = events(now).map((e) => ({
    id: `sample-${e.id}`,
    title: e.title[locale],
    start: e.start,
    end: e.end,
    note: e.note?.[locale] ?? '',
    categoryId: `sample-${e.folder}`,
    tagIds: (e.tags ?? []).map((t) => `sample-${t}`),
    links: (e.links ?? []).map((l) => `sample-${l}`),
    createdAt: '',
    updatedAt: stamp,
    deleted: false,
  }))
  return { app: 'chronoscope', version: 2, exportedAt: now.toISOString(), data: { events: evs, categories, tags } }
}
