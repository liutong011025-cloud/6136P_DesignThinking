export const COURSE_ID = "INT6136P";
export const GROUP_NAMES = [
  "獅子山上的青春", "连名字都想让AI取", "WIFI密码8个（8）", "ai联盟-aiep", "一半儿一半儿",
  "人本智行", "豆包Eduhk限定版", "刚刚好", "收手吧阿组", "8 颗神经元", "脑洞处理器",
  "AI打杂天团", "全都星", "711", "唔知叫咩名", "AIEP复仇者联盟", "Aimoney", "八方来财",
  "合光共燃", "哈吉米南北绿豆", "六个核桃队", "AAA教大苹果供应", "👑Real-Seven-Eleven",
  "元启TEAM", "缘聚大埔山，科技赴新程", "测试组"
] as const;
export const OFFICIAL_GROUP_COUNT = 25;
export const PRACTICE_GROUP_ID = 26;
export const GROUP_MEMBER_LIMIT = 0;
export const RESEARCH_SOURCES = ["Article", "Journal", "Case", "Material"] as const;
export const SOURCE_LABELS = { Article: "研究文章", Journal: "期刊论文", Case: "案例研究", Material: "其他资料", Experience: "个人经验", Assumption: "待验证想法" } as const;
export const STEPS = [
  { key: "observation", title: "个人阅读与选题", phase: "共情理解", number: "01" },
  { key: "discussion", title: "小组交流", phase: "共情理解", number: "02" },
  { key: "evidence", title: "依据与待查问题", phase: "共情理解", number: "03" },
  { key: "summary", title: "研究小结", phase: "共情理解", number: "04" },
  { key: "findings", title: "整理主题与观点", phase: "定义问题", number: "05" },
  { key: "focus", title: "确定报告主题", phase: "定义问题", number: "06" },
  { key: "definition", title: "规划 20 分钟报告", phase: "构思与验证", number: "07" },
  { key: "review", title: "讨论反思与提交", phase: "构思与验证", number: "08" },
  { key: "submitted", title: "已保存的报告方案", phase: "构思与验证", number: "09" }
] as const;
export type StepKey = typeof STEPS[number]["key"];
