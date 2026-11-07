/**
 * SMS length rules. GSM-7 messages hold 160 characters in one segment and
 * 153 per segment when concatenated. Any character outside the GSM-7 set
 * forces UCS-2: 70 characters, or 67 per segment when concatenated.
 */
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = "^{}\\[~]|€";

export interface SmsStats {
  encoding: "GSM-7" | "UCS-2";
  characters: number;
  segments: number;
  perSegment: number;
}

export function smsStats(text: string): SmsStats {
  let gsm = true;
  let units = 0;
  for (const ch of text) {
    if (GSM7.includes(ch)) units += 1;
    else if (GSM7_EXT.includes(ch)) units += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (!gsm) {
    const len = [...text].length;
    const segments = len === 0 ? 0 : len <= 70 ? 1 : Math.ceil(len / 67);
    return { encoding: "UCS-2", characters: len, segments, perSegment: segments > 1 ? 67 : 70 };
  }
  const segments = units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153);
  return { encoding: "GSM-7", characters: units, segments, perSegment: segments > 1 ? 153 : 160 };
}
