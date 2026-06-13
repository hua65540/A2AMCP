import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicSkill = path.join(root, "skills", "a2a-handoff", "SKILL.md");
const personalSkill = path.join(process.env.HOME ?? "", ".codex", "skills", "a2a-handoff-personal", "SKILL.md");
const includePersonal = process.env.A2A_VALIDATE_PERSONAL_SKILL === "1";

const checks = [
  {
    path: publicSkill,
    label: "public skill",
    required: [
      "name: a2a-handoff",
      "start_handoff",
      "poll_messages",
      "send_message",
      "finish_handoff",
      "Thread Automation",
      "30 秒",
      "1 分钟",
      "首次发言",
      "历史消息",
      "风险触发验证",
      "角色清单"
    ],
    forbidden: ["强硬拒绝", "对方 AI 道歉累计 3 次"]
  }
];

if (includePersonal) {
  checks.push({
    path: personalSkill,
    label: "personal skill",
    required: [
      "name: a2a-handoff-personal",
      "a2a-handoff",
      "严重错误",
      "道歉",
      "累计 3 次",
      "pause_handoff",
      "要求人类更换或升级对方 AI"
    ],
    forbidden: []
  });
}

let failed = false;
for (const check of checks) {
  if (!existsSync(check.path)) {
    console.error(`${check.label} missing: ${check.path}`);
    failed = true;
    continue;
  }
  const text = readFileSync(check.path, "utf8");
  for (const needle of check.required) {
    if (!text.includes(needle)) {
      console.error(`${check.label} missing required text: ${needle}`);
      failed = true;
    }
  }
  for (const needle of check.forbidden) {
    if (text.includes(needle)) {
      console.error(`${check.label} contains forbidden text: ${needle}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log("Skill validation passed.");
