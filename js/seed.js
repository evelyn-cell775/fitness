/* 首次使用时预置的动作库（健身 + 康复） */

const SEED_EXERCISES = [
  // 胸部
  { name: '俯卧撑', category: 'chest', emoji: '💪', desc: '徒手胸肌训练，注意核心收紧、身体呈一条直线。' },
  { name: '卧推', category: 'chest', emoji: '🏋️‍♂️', desc: '杠铃/哑铃卧推，胸部经典复合动作。' },
  { name: '哑铃飞鸟', category: 'chest', emoji: '🦋', desc: '孤立刺激胸大肌，注意肘部微屈。' },
  // 背部
  { name: '引体向上', category: 'back', emoji: '🧗', desc: '背部宽度训练之王，可借助弹力带辅助。' },
  { name: '哑铃划船', category: 'back', emoji: '🚣', desc: '单臂哑铃划船，锻炼背阔肌厚度。' },
  // 腿部
  { name: '深蹲', category: 'legs', emoji: '🦵', desc: '下肢王牌动作，注意膝盖与脚尖方向一致。' },
  { name: '弓步蹲', category: 'legs', emoji: '🚶‍♂️', desc: '单腿力量与平衡训练。' },
  { name: '提踵', category: 'legs', emoji: '🦶', desc: '小腿训练，站姿或台阶上完成。' },
  // 肩部
  { name: '哑铃肩推', category: 'shoulder', emoji: '🏋️', desc: '坐姿/站姿推举，锻炼三角肌前中束。' },
  { name: '侧平举', category: 'shoulder', emoji: '🦅', desc: '三角肌中束孤立训练，小重量多次数。' },
  // 核心
  { name: '平板支撑', category: 'core', emoji: '🪵', desc: '核心稳定经典动作，保持身体一条直线。' },
  { name: '卷腹', category: 'core', emoji: '🤸', desc: '上腹训练，下背部贴地。' },
  { name: '俄罗斯转体', category: 'core', emoji: '🌀', desc: '腹斜肌训练，可持重物增加难度。' },
  // 有氧
  { name: '跑步', category: 'cardio', emoji: '🏃', desc: '有氧之王，注意跑前热身与跑后拉伸。' },
  { name: '快走', category: 'cardio', emoji: '🚶', desc: '低强度有氧，适合康复期和恢复日。' },
  { name: '跳绳', category: 'cardio', emoji: '🪢', desc: '高效燃脂，注意落地缓冲。' },
  { name: '开合跳', category: 'cardio', emoji: '🤸‍♀️', desc: '全身热身/燃脂动作。' },
  // 肩颈康复
  { name: '颈部拉伸', category: 'neck', emoji: '🙆', desc: '低头族必备，前后左右各方向缓慢拉伸。' },
  { name: '肩部环绕', category: 'neck', emoji: '💫', desc: '肩关节活动度训练，前后各绕 10 圈。' },
  { name: '弹力带肩外旋', category: 'neck', emoji: '🎗️', desc: '肩袖肌群强化，改善圆肩。' },
  // 腰背康复
  { name: '小燕飞', category: 'waist', emoji: '🕊️', desc: '俯卧抬头抬腿，强化下背部。' },
  { name: '猫式伸展', category: 'waist', emoji: '🐱', desc: '脊柱灵活性训练，配合呼吸。' },
  { name: '臀桥', category: 'waist', emoji: '🌉', desc: '激活臀部与下背，改善腰肌劳损。' },
  // 膝关节康复
  { name: '直腿抬高', category: 'knee', emoji: '🦵', desc: '股四头肌强化，膝关节术后/康复常用。' },
  { name: '靠墙静蹲', category: 'knee', emoji: '🧱', desc: '膝盖友好的大腿力量训练，注意膝盖不超过脚尖。' },
];
