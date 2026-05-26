// Voice Engram - Style Analysis & Voice Fingerprinting
// Analyzes writing patterns to build a style profile that AI uses to match the author's voice

export interface VoiceEngram {
  metrics: StyleMetrics;
  analysis?: VoiceAnalysis;
  lastUpdated: number;
  chapterCount: number;
  wordCount: number;
}

export interface StyleMetrics {
  avgSentenceLength: number;
  sentenceLengthVariance: number;
  vocabularyRichness: number;
  distinctiveWords: string[];
  adverbFrequency: number;
  dialogueRatio: number;
  avgParagraphLength: number;
  sensoryProfile: SensoryProfile;
  openingPatterns: string[];
}

export interface SensoryProfile {
  visual: number;
  auditory: number;
  tactile: number;
  olfactory: number;
  gustatory: number;
}

export interface VoiceAnalysis {
  tone: string;
  povStyle: string;
  imageryPreferences: string;
  pacingPattern: string;
  dialogueStyle: string;
  uniqueFingerprints: string[];
  summary: string;
}

const STOPWORDS = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','was','are','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','not','no','nor','so','if','then','than','that','this','these','those','it','its','he','she','they','we','you','i','me','him','her','us','them','my','his','your','our','their','what','which','who','whom','when','where','how','why','all','each','every','both','few','more','most','other','some','such','only','own','same','just','also','very','much','too','quite','about','up','out','into','over','after','before','between','through','during','without','within','along','upon','across','behind','beyond','around','against','above','below','said','like','one','two','back','now','still','even','here','there','again','never','always','enough']);

const SENSORY_WORDS: Record<keyof SensoryProfile, string[]> = {
  visual: ['gleam','glow','shimmer','shadow','dark','bright','flash','pale','crimson','golden','silver','light','dim','blaze','flicker','shine','radiant','luminous','vivid','silhouette','dusk','dawn'],
  auditory: ['whisper','roar','thunder','hum','crack','echo','silence','murmur','howl','boom','hiss','rumble','screech','wail','rustle','clang','creak','snap','splash','thud'],
  tactile: ['cold','warm','hot','smooth','rough','sharp','soft','hard','wet','dry','tender','brittle','sting','burn','chill','freeze','caress','grip','press','weight','heavy','breeze','wind','gust'],
  olfactory: ['scent','smell','stench','fragrance','reek','aroma','musk','rot','smoke','fresh','pungent','acrid','earthy','damp','musty'],
  gustatory: ['sweet','bitter','sour','salty','taste','savour','tang','rich','bland','spice','metallic','honey','blood','wine','ale'],
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function getSentences(text: string): string[] {
  return text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 3);
}

function getWords(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z\s'-]/g, '').split(/\s+/).filter(w => w.length > 1);
}

function getParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 10);
}

export function analyzeStyle(chapters: { title: string; content: string }[]): StyleMetrics {
  const allText = chapters.map(ch => stripHtml(ch.content)).join('\n\n');
  const sentences = getSentences(allText);
  const words = getWords(allText);
  const paragraphs = getParagraphs(allText);

  if (words.length < 10) return getEmptyMetrics();

  const sentLengths = sentences.map(s => getWords(s).length);
  const avgSentenceLength = sentLengths.reduce((a, b) => a + b, 0) / (sentLengths.length || 1);
  const variance = sentLengths.reduce((sum, l) => sum + Math.pow(l - avgSentenceLength, 2), 0) / (sentLengths.length || 1);
  const sentenceLengthVariance = Math.sqrt(variance);

  const uniqueWords = new Set(words);
  const vocabularyRichness = uniqueWords.size / words.length;

  const wordFreq: Record<string, number> = {};
  words.forEach(w => { if (!STOPWORDS.has(w) && w.length > 3) wordFreq[w] = (wordFreq[w] || 0) + 1; });
  const distinctiveWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([word]) => word);

  const adverbs = words.filter(w => w.endsWith('ly') && w.length > 4);
  const adverbFrequency = adverbs.length / words.length;

  const dialogueMatches = allText.match(/["\u201C][^"\u201D]*["\u201D]/g) || [];
  const dialogueWords = dialogueMatches.join(' ').split(/\s+/).length;
  const dialogueRatio = dialogueWords / words.length;

  const avgParagraphLength = paragraphs.reduce((sum, p) => sum + getWords(p).length, 0) / (paragraphs.length || 1);

  const sensoryProfile: SensoryProfile = { visual: 0, auditory: 0, tactile: 0, olfactory: 0, gustatory: 0 };
  for (const [sense, senseWords] of Object.entries(SENSORY_WORDS)) {
    const count = words.filter(w => senseWords.includes(w)).length;
    sensoryProfile[sense as keyof SensoryProfile] = count / words.length;
  }

  const openingPatterns = chapters.map(ch => {
    const text = stripHtml(ch.content);
    const first = getSentences(text)[0] || '';
    if (first.match(/^(the |a |an )(wind|sun|moon|sky|rain|storm|sea|mountain)/i)) return 'environment-first';
    if (first.match(/^(he|she|they|\w+ (was|were|stood|sat|walked))/i)) return 'character-action';
    if (first.match(/^["\u201C]/)) return 'dialogue-open';
    if (first.match(/^(in |on |at |above |below |beyond )/i)) return 'spatial-grounding';
    if (first.match(/^(when |if |before |after )/i)) return 'temporal-hook';
    return 'declarative';
  });

  return {
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    sentenceLengthVariance: Math.round(sentenceLengthVariance * 10) / 10,
    vocabularyRichness: Math.round(vocabularyRichness * 1000) / 1000,
    distinctiveWords, adverbFrequency: Math.round(adverbFrequency * 10000) / 10000,
    dialogueRatio: Math.round(dialogueRatio * 1000) / 1000,
    avgParagraphLength: Math.round(avgParagraphLength * 10) / 10,
    sensoryProfile, openingPatterns,
  };
}

function getEmptyMetrics(): StyleMetrics {
  return { avgSentenceLength: 0, sentenceLengthVariance: 0, vocabularyRichness: 0, distinctiveWords: [], adverbFrequency: 0, dialogueRatio: 0, avgParagraphLength: 0, sensoryProfile: { visual: 0, auditory: 0, tactile: 0, olfactory: 0, gustatory: 0 }, openingPatterns: [] };
}

export function buildVoicePrompt(engram: VoiceEngram): string {
  const { metrics, analysis } = engram;
  let prompt = 'AUTHOR VOICE PROFILE (match this style exactly):\n';
  if (analysis?.summary) prompt += analysis.summary + '\n\n';
  prompt += 'Quantitative style markers:\n';
  prompt += `- Sentence length: avg ${metrics.avgSentenceLength} words (variance: ${metrics.sentenceLengthVariance})\n`;
  prompt += `- Vocabulary richness: ${(metrics.vocabularyRichness * 100).toFixed(1)}% unique words\n`;
  prompt += `- Adverb usage: ${metrics.adverbFrequency < 0.01 ? 'minimal' : metrics.adverbFrequency < 0.02 ? 'moderate' : 'frequent'}\n`;
  prompt += `- Dialogue ratio: ${(metrics.dialogueRatio * 100).toFixed(0)}% of text\n`;
  prompt += `- Paragraph length: avg ${metrics.avgParagraphLength} words\n`;
  const topSense = Object.entries(metrics.sensoryProfile).sort((a, b) => b[1] - a[1]);
  prompt += `- Sensory preference: ${topSense[0][0]} > ${topSense[1][0]} > ${topSense[2][0]}\n`;
  prompt += `- Distinctive vocabulary: ${metrics.distinctiveWords.slice(0, 10).join(', ')}\n`;
  prompt += `- Chapter openings: ${[...new Set(metrics.openingPatterns)].join(', ')}\n`;
  if (analysis) {
    prompt += '\nVoice characteristics:\n';
    if (analysis.tone) prompt += `- Tone: ${analysis.tone}\n`;
    if (analysis.povStyle) prompt += `- POV: ${analysis.povStyle}\n`;
    if (analysis.imageryPreferences) prompt += `- Imagery: ${analysis.imageryPreferences}\n`;
    if (analysis.pacingPattern) prompt += `- Pacing: ${analysis.pacingPattern}\n`;
    if (analysis.dialogueStyle) prompt += `- Dialogue: ${analysis.dialogueStyle}\n`;
    if (analysis.uniqueFingerprints?.length) prompt += `- Unique traits: ${analysis.uniqueFingerprints.join('; ')}\n`;
  }
  prompt += '\nIMPORTANT: Match this voice exactly. Do NOT make the writing more generic, modern, or casual unless explicitly asked.\n';
  return prompt;
}
