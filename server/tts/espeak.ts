import { spawn } from 'node:child_process';
import { config } from '../config';
import { ProviderError } from '../http';
import type { TtsProvider, TtsResult } from './types';

/** 외부 프로그램을 실행해 stdout을 모은다 (시간 제한 포함) */
function run(cmd: string, args: string[], input: Uint8Array | string | null, timeoutMs: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'ignore'] });
    const out: Buffer[] = [];
    const timer = setTimeout(() => {
      p.kill('SIGKILL');
      reject(new ProviderError('timeout', `${cmd} 시간 초과`));
    }, timeoutMs);
    p.stdout.on('data', (d: Buffer) => out.push(d));
    p.on('error', (e) => {
      clearTimeout(timer);
      reject(new ProviderError('not_configured', `${cmd} 실행 실패: ${e.message}`));
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(new Uint8Array(Buffer.concat(out)));
      else reject(new ProviderError('provider_error', `${cmd} 종료 코드 ${code}`));
    });
    if (input !== null) p.stdin.end(input);
    else p.stdin.end();
  });
}

let checked: Promise<boolean> | null = null;
const hasBinary = (bin: string, flag: string) =>
  run(bin, [flag], null, 3000).then(
    () => true,
    () => false,
  );

/**
 * espeak-ng (로컬, 무료, API 키 불필요). 아랍어 음성은 기계음에 가깝지만 모음 부호를 읽어 발음한다.
 * 설치: Ubuntu/Debian `apt-get install espeak-ng ffmpeg`
 */
export const espeakProvider: TtsProvider = {
  id: 'espeak-ng',
  get voiceKey() {
    return `espeak:${config.tts.espeakVoice}`;
  },
  available() {
    checked ??= Promise.all([hasBinary('espeak-ng', '--version'), hasBinary('ffmpeg', '-version')]).then(([a, b]) => a && b);
    return checked;
  },
  async synthesize(text: string): Promise<TtsResult> {
    // 텍스트는 stdin으로 넘겨 명령행 주입을 막는다.
    const wav = await run('espeak-ng', ['-v', config.tts.espeakVoice, '-s', '140', '--stdin', '--stdout'], text, 10_000);
    if (wav.byteLength < 1000) throw new ProviderError('provider_error', 'espeak-ng가 빈 음성을 만들었습니다');
    const mp3 = await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-b:a', '48k', '-f', 'mp3', 'pipe:1'], wav, 10_000);
    return { audio: mp3, contentType: 'audio/mpeg' };
  },
};
