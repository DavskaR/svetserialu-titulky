export function vttToSrt(vtt: string): string {
  const normalized = vtt.replace(/\r\n/g, '\n');
  const blocks = normalized.trim().split(/\n\s*\n/);
  const cues: Array<{ timing: string; text: string }> = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx === -1) continue;

    const timing = lines[timeIdx];
    const textLines = lines
      .slice(timeIdx + 1)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (textLines.length === 0) continue;

    const srtTiming = timing.replace(/\.(\d{3})/g, ',$1');
    cues.push({ timing: srtTiming, text: textLines.join('\n') });
  }

  if (cues.length === 0) {
    return vttToSrtLegacy(vtt);
  }

  return cues.map((c, i) => `${i + 1}\n${c.timing}\n${c.text}`).join('\n\n') + '\n';
}

function vttToSrtLegacy(vtt: string): string {
  const normalized = vtt.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  let result = '';
  let index = 0;
  let cueTiming = '';
  let cueLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.includes('-->')) {
      if (cueTiming && cueLines.length > 0) {
        index++;
        result += `${index}\n${cueTiming}\n${cueLines.join('\n')}\n\n`;
        cueLines = [];
      }
      cueTiming = line.replace(/\.(\d{3})/g, ',$1');
      continue;
    }

    if (line.length === 0 && cueTiming && cueLines.length > 0) {
      index++;
      result += `${index}\n${cueTiming}\n${cueLines.join('\n')}\n\n`;
      cueTiming = '';
      cueLines = [];
      continue;
    }

    if (cueTiming && line.length > 0) {
      cueLines.push(line);
    }
  }

  if (cueTiming && cueLines.length > 0) {
    index++;
    result += `${index}\n${cueTiming}\n${cueLines.join('\n')}\n\n`;
  }

  return result.trim() ? result.trim() + '\n' : '';
}
