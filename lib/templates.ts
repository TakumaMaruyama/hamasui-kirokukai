import { Athlete, Event, Meet, Result } from "@prisma/client";

export function recordTemplate({
  athlete,
  meet,
  results
}: {
  athlete: Athlete;
  meet: Meet;
  results: Array<Result & { event: Event }>;
}): string {
  const rows = results
    .map(
      (result) => `
      <tr>
        <td>${result.event.title}</td>
        <td>${result.timeText}</td>
        <td>${result.rank}位</td>
      </tr>`
    )
    .join("");

  return `
  <html>
    <head>
      <style>
        body { font-family: 'Noto Sans JP', sans-serif; padding: 40px; }
        h1 { text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 8px; }
      </style>
    </head>
    <body>
      <h1>${meet.title} 記録証</h1>
      <p>氏名: ${athlete.fullName}</p>
      <p>学年: ${athlete.grade}年 / 性別: ${athlete.gender}</p>
      <p>開催日: ${meet.heldOn.toISOString().slice(0, 10)}</p>
      <table>
        <thead>
          <tr><th>種目</th><th>記録</th><th>順位</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </body>
  </html>
  `;
}

export function certificateTemplate({
  athlete,
  meet,
  result
}: {
  athlete: Athlete;
  meet: Meet;
  result: Result & { event: Event };
}): string {
  return `
  <html>
    <head>
      <style>
        body { font-family: 'Noto Sans JP', sans-serif; padding: 80px; text-align: center; }
        h1 { font-size: 32px; margin-bottom: 40px; }
      </style>
    </head>
    <body>
      <h1>賞状</h1>
      <p>${meet.title}</p>
      <p>${result.event.title}</p>
      <p>第1位</p>
      <h2>${athlete.fullName} 様</h2>
      <p>記録: ${result.timeText}</p>
    </body>
  </html>
  `;
}
