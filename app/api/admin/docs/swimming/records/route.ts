import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { renderRecordCertificatePdf } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { zipBuffers } from "@/lib/zip";
import { buildMeetWhere, parseDocsFilterInput } from "@/lib/docs-filter";
import { buildRecordCertificates, type RecordCertificateSourceRow } from "@/lib/record-certificate";

export const runtime = "nodejs";

function isMissingFullNameKanaColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /Athlete\.fullNameKana|column .*fullNameKana.* does not exist/i.test(message);
}

async function findRecordCertificateRows(options: {
  meetWhere: ReturnType<typeof buildMeetWhere> | { id: string };
  fullName?: string;
}): Promise<RecordCertificateSourceRow[]> {
  const where = {
    meet: options.meetWhere,
    ...(options.fullName ? { athlete: { fullName: options.fullName } } : {})
  } as const;

  const orderBy = [
    { athlete: { fullName: "asc" as const } },
    { event: { title: "asc" as const } },
    { timeMs: "asc" as const },
    { meet: { heldOn: "asc" as const } }
  ];

  try {
    const rows = await prisma.result.findMany({
      where,
      include: {
        athlete: {
          select: {
            id: true,
            fullName: true,
            fullNameKana: true,
            grade: true,
            gender: true
          }
        },
        event: {
          select: {
            id: true,
            title: true
          }
        },
        meet: {
          select: {
            heldOn: true
          }
        }
      },
      orderBy
    });

    return rows.map((row) => ({
      athleteId: row.athleteId,
      eventId: row.eventId,
      athlete: {
        fullName: row.athlete.fullName,
        fullNameKana: row.athlete.fullNameKana,
        grade: row.athlete.grade,
        gender: row.athlete.gender
      },
      event: {
        title: row.event.title
      },
      timeText: row.timeText,
      timeMs: row.timeMs,
      meet: {
        heldOn: row.meet.heldOn
      }
    }));
  } catch (error) {
    if (!isMissingFullNameKanaColumnError(error)) {
      throw error;
    }
  }

  const rows = await prisma.result.findMany({
    where,
    include: {
      athlete: {
        select: {
          id: true,
          fullName: true,
          grade: true,
          gender: true
        }
      },
      event: {
        select: {
          id: true,
          title: true
        }
      },
      meet: {
        select: {
          heldOn: true
        }
      }
    },
    orderBy
  });

  return rows.map((row) => ({
    athleteId: row.athleteId,
    eventId: row.eventId,
    athlete: {
      fullName: row.athlete.fullName,
      fullNameKana: null,
      grade: row.athlete.grade,
      gender: row.athlete.gender
    },
    event: {
      title: row.event.title
    },
    timeText: row.timeText,
    timeMs: row.timeMs,
    meet: {
      heldOn: row.meet.heldOn
    }
  }));
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request
    .json()
    .catch(() => ({}));
  const parsedFilter = parseDocsFilterInput(rawBody);

  if (!parsedFilter.ok) {
    return NextResponse.json({ message: parsedFilter.message }, { status: 400 });
  }

  try {
    const filter = parsedFilter.value;
    const latestMeet = filter.hasMonthFilter
      ? null
      : await prisma.meet.findFirst({
          where: { program: "swimming" },
          orderBy: { heldOn: "desc" }
        });

    if (!filter.hasMonthFilter && !latestMeet) {
      return NextResponse.json({ message: "条件に一致する記録会がありません" }, { status: 400 });
    }

    const meetWhere = filter.hasMonthFilter
      ? buildMeetWhere("swimming", filter)
      : { id: latestMeet!.id };
    const rows = await findRecordCertificateRows({
      meetWhere,
      fullName: filter.fullName
    });

    if (rows.length === 0) {
      return NextResponse.json({ message: "条件に一致する記録がありません" }, { status: 400 });
    }

    const certificates = buildRecordCertificates(
      rows,
      filter.hasMonthFilter && typeof filter.year === "number" && typeof filter.month === "number"
        ? { year: filter.year, month: filter.month }
        : undefined
    );

    const files = [] as { name: string; buffer: Buffer }[];
    for (const certificate of certificates) {
      const buffer = await renderRecordCertificatePdf({
        athlete: certificate.athlete,
        entries: certificate.entries,
        issueLabel: certificate.issueLabel
      });
      const name = certificate.fileName;
      const storageKey = await saveBuffer(`swimming/records/${name}`, buffer);

      await prisma.generatedDoc.create({
        data: {
          program: "swimming",
          kind: "record",
          storageKey
        }
      });

      files.push({ name, buffer });
    }

    if (files.length === 0) {
      return NextResponse.json({ message: "条件に一致する記録がありません" }, { status: 400 });
    }

    const zip = await zipBuffers(files);

    return new NextResponse(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=swimming_records.zip"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF生成中にエラーが発生しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
