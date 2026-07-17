const prohibitedPatterns: readonly RegExp[] = [
  /治(る|します|せる)/u,
  /改善(する|します|できる)/u,
  /病気/u,
  /不眠(症)?が(治|改善)/u,
  /\d+\s*Hz.*(効く|効果|改善|治)/iu
];

export function lintText(text: string): readonly string[] {
  return prohibitedPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `断定的な健康効能表現の疑いがあります: ${pattern.source}`);
}
