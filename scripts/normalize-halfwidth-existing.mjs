import { PrismaClient } from "@prisma/client";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const prisma = new PrismaClient();

function toHalfWidthDigits(value) {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

function normalizeText(value) {
  const normalized = toHalfWidthDigits(value);
  return normalized === value ? null : normalized;
}

function meetKey(program, heldOn, title) {
  return `${program}|${heldOn.toISOString()}|${title}`;
}

async function buildUpdatePlan() {
  const plan = {
    athleteFullName: [],
    athleteFullNameKana: [],
    meetTitle: [],
    eventTitle: [],
    resultTimeText: [],
    meetTitleConflicts: []
  };

  const athletes = await prisma.athlete.findMany({
    select: { id: true, fullName: true, fullNameKana: true }
  });
  for (const athlete of athletes) {
    const fullName = normalizeText(athlete.fullName);
    if (fullName) {
      plan.athleteFullName.push({ id: athlete.id, value: fullName });
    }

    if (athlete.fullNameKana) {
      const fullNameKana = normalizeText(athlete.fullNameKana);
      if (fullNameKana) {
        plan.athleteFullNameKana.push({ id: athlete.id, value: fullNameKana });
      }
    }
  }

  const meets = await prisma.meet.findMany({
    select: { id: true, program: true, heldOn: true, title: true },
    orderBy: [{ heldOn: "asc" }, { createdAt: "asc" }]
  });

  const occupiedMeetKeys = new Set(meets.map((meet) => meetKey(meet.program, meet.heldOn, meet.title)));
  for (const meet of meets) {
    const normalizedTitle = normalizeText(meet.title);
    if (!normalizedTitle) {
      continue;
    }

    const currentKey = meetKey(meet.program, meet.heldOn, meet.title);
    const nextKey = meetKey(meet.program, meet.heldOn, normalizedTitle);
    if (currentKey !== nextKey && occupiedMeetKeys.has(nextKey)) {
      plan.meetTitleConflicts.push({
        id: meet.id,
        before: meet.title,
        after: normalizedTitle,
        heldOn: meet.heldOn.toISOString().slice(0, 10),
        program: meet.program
      });
      continue;
    }

    occupiedMeetKeys.delete(currentKey);
    occupiedMeetKeys.add(nextKey);
    plan.meetTitle.push({ id: meet.id, value: normalizedTitle });
  }

  const events = await prisma.event.findMany({
    select: { id: true, title: true }
  });
  for (const event of events) {
    const title = normalizeText(event.title);
    if (title) {
      plan.eventTitle.push({ id: event.id, value: title });
    }
  }

  const results = await prisma.result.findMany({
    select: { id: true, timeText: true }
  });
  for (const result of results) {
    const timeText = normalizeText(result.timeText);
    if (timeText) {
      plan.resultTimeText.push({ id: result.id, value: timeText });
    }
  }

  return plan;
}

async function applyPlan(plan) {
  for (const row of plan.athleteFullName) {
    await prisma.athlete.update({
      where: { id: row.id },
      data: { fullName: row.value }
    });
  }

  for (const row of plan.athleteFullNameKana) {
    await prisma.athlete.update({
      where: { id: row.id },
      data: { fullNameKana: row.value }
    });
  }

  for (const row of plan.meetTitle) {
    await prisma.meet.update({
      where: { id: row.id },
      data: { title: row.value }
    });
  }

  for (const row of plan.eventTitle) {
    await prisma.event.update({
      where: { id: row.id },
      data: { title: row.value }
    });
  }

  for (const row of plan.resultTimeText) {
    await prisma.result.update({
      where: { id: row.id },
      data: { timeText: row.value }
    });
  }
}

function printSummary(plan, applied) {
  console.log("half-width normalization summary");
  console.log(`- athlete.fullName: ${plan.athleteFullName.length}`);
  console.log(`- athlete.fullNameKana: ${plan.athleteFullNameKana.length}`);
  console.log(`- meet.title: ${plan.meetTitle.length}`);
  console.log(`- event.title: ${plan.eventTitle.length}`);
  console.log(`- result.timeText: ${plan.resultTimeText.length}`);
  console.log(`- meet.title conflicts skipped: ${plan.meetTitleConflicts.length}`);

  if (plan.meetTitleConflicts.length > 0) {
    console.log("  skipped meet.title conflicts:");
    for (const conflict of plan.meetTitleConflicts.slice(0, 20)) {
      console.log(
        `  - ${conflict.id} [${conflict.program} ${conflict.heldOn}] "${conflict.before}" -> "${conflict.after}"`
      );
    }
    if (plan.meetTitleConflicts.length > 20) {
      console.log(`  ... and ${plan.meetTitleConflicts.length - 20} more`);
    }
  }

  console.log(applied ? "applied=true" : "applied=false (dry-run)");
}

async function main() {
  const shouldApply = process.argv.includes("--apply");

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL が未設定です。.env.local などに設定してから `npm run normalize:halfwidth -- --apply` を実行してください。"
    );
  }

  const plan = await buildUpdatePlan();
  if (shouldApply) {
    await applyPlan(plan);
  }
  printSummary(plan, shouldApply);
}

main()
  .catch((error) => {
    console.error("normalization failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
