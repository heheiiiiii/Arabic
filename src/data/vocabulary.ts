/**
 * [임시] 공부 메뉴의 "준비 중" 화면에서 보여 줄 맛보기 데이터.
 * 실제 학습 콘텐츠·진도 시스템은 다음 작업에서 이 파일을 확장해 구현한다.
 */

export interface StudyItem {
  ar: string;
  ko: string;
}

export const SAMPLE_WORDS: StudyItem[] = [
  { ar: 'بَيْتٌ', ko: '집' },
  { ar: 'قَرْيَةٌ', ko: '마을' },
  { ar: 'صَدِيقٌ', ko: '친구' },
];

export const SAMPLE_SENTENCES: StudyItem[] = [
  { ar: 'مَرْحَبًا!', ko: '안녕!' },
  { ar: 'أَنَا بِخَيْرٍ، شُكْرًا.', ko: '잘 지내, 고마워.' },
];
