/**
 * 학습 문장 음성을 미리 만든다: public/audio/tts/<hash>.mp3
 *   npm run audio:build   (espeak-ng + ffmpeg 필요)
 * 서버 없이 정적으로 배포해도 학습 콘텐츠·연습 대화의 음성을 들을 수 있게 하기 위함이다.
 * 파일 이름은 src/shared/hash.ts의 prebuiltAudioPath()와 같아야 한다.
 */
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ALL_ITEMS } from '../src/learning/content';
import { LAYLA } from '../src/data/dialogue';
import { practiceReply } from '../src/shared/practiceNpc';
import { prebuiltAudioPath } from '../src/shared/hash';
import { splitSentences } from '../src/shared/sentences';
import type { AddressGender, ChatRequest, NpcReply } from '../src/shared/conversation';
import { espeakProvider } from '../server/tts/espeak';
import { sanitizeTtsText } from '../server/tts';

const OUT = path.resolve('public');

function collectReply(r: NpcReply, add: (t: string) => void) {
  for (const t of [r.reply.ar, r.hint.model.ar, ...r.hint.alternatives, ...r.hint.words.map((w) => w.ar)]) {
    add(t);
    splitSentences(t).forEach(add);
  }
}

async function main() {
  if (!(await espeakProvider.available())) throw new Error('espeak-ng 와 ffmpeg 가 필요합니다');
  const texts = new Set<string>();
  const add = (t: string) => t.trim() && texts.add(t.trim());
  for (const it of ALL_ITEMS) add(it.tts ?? it.ar);
  for (const l of LAYLA.greeting) {
    add(l.ar);
    splitSentences(l.ar).forEach(add);
  }
  // 연습 상대가 낼 수 있는 문장 (여러 입력·성별·진행 단계로 실행해 모은다)
  const inputs = [null, 'مرحبا', 'السلام عليكم', 'صباح الخير', 'مساء الخير', 'كيف الحال', 'انا بخير', 'اسمي سارة', 'انا من كوريا', 'احب الشاي', 'شكرا', 'نعم', 'لا', 'مع السلامة', 'abc', 'كلام غريب'];
  for (const g of ['m', 'f', 'unspecified'] as AddressGender[]) {
    for (let asked = 0; asked <= 6; asked++) {
      for (const playerText of inputs) {
        const history: ChatRequest['history'] = [];
        // asked 단계만큼 앞 주제들을 이미 물은 것으로 만든다
        let req: ChatRequest = { npcId: 'layla', playerText: null, history, memory: { facts: [], topics: [], conversations: (asked % 2) + 1 }, learner: { level: 1, unitTitleKo: '', comfortable: [], needsReview: [], seenOnly: [], studiedCount: 0 }, addressGender: g };
        for (let i = 0; i < asked; i++) {
          const r = practiceReply({ ...req, playerText: 'نعم' });
          history.push({ role: 'player', text: 'نعم' }, { role: 'npc', text: r.reply.ar });
          req = { ...req, history: [...history] };
        }
        collectReply(practiceReply({ ...req, playerText }), add);
      }
    }
  }

  let made = 0;
  let skipped = 0;
  const manifest: Record<string, string> = {};
  for (const t of texts) {
    const rel = prebuiltAudioPath(t);
    manifest[rel] = t;
    const file = path.join(OUT, rel);
    const exists = await readFile(file).then(() => true, () => false);
    if (exists) {
      skipped++;
      continue;
    }
    const clean = sanitizeTtsText(t);
    if (!clean) continue;
    const r = await espeakProvider.synthesize(clean);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, r.audio);
    made++;
  }
  // 더 이상 쓰지 않는 음성 파일 정리
  let removed = 0;
  const keep = new Set(Object.keys(manifest).map((rel) => path.basename(rel)));
  for (const f of await readdir(path.join(OUT, 'audio/tts'))) {
    if (f.endsWith('.mp3') && !keep.has(f)) {
      await unlink(path.join(OUT, 'audio/tts', f));
      removed++;
    }
  }
  if (removed) console.log(`쓰지 않는 음성 파일 ${removed}개 삭제`);
  await writeFile(path.join(OUT, 'audio/tts/manifest.json'), JSON.stringify({ voice: espeakProvider.voiceKey, files: manifest }, null, 1));
  console.log(`음성 파일: 새로 ${made}개, 기존 ${skipped}개, 전체 문장 ${texts.size}개`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
